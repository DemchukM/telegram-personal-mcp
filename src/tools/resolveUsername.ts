import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for ResolveUsername parameters
 */
export const ResolveUsernameParamsSchema = z.object({
  username: z.string().min(1).describe('Username to resolve (with or without @ prefix), or an invite link like t.me/joinchat/xxx'),
});

/**
 * Resolve Username Tool - Resolve a @username or link to entity info
 */
export const resolveUsernameTool: Tool<undefined, typeof ResolveUsernameParamsSchema> = {
  name: "resolveUsername",
  description: "Resolve a Telegram @username, phone number, or t.me link to a full entity with ID, name, and type. Useful for converting human-readable identifiers to numeric IDs.",
  parameters: ResolveUsernameParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Resolving username", { username: args.username });

    const validArgs = ResolveUsernameParamsSchema.parse(args);
    const client = await createClient();

    try {
      const entity = await client.getEntity(validArgs.username) as any;
      const className = entity.className;

      let result: Record<string, any>;

      if (className === 'User') {
        result = {
          type: 'user',
          id: entity.id?.toString(),
          firstName: entity.firstName || null,
          lastName: entity.lastName || null,
          username: entity.username || null,
          bot: entity.bot || false,
          phone: entity.phone || null,
        };
      } else if (className === 'Channel') {
        result = {
          type: entity.megagroup ? 'supergroup' : 'channel',
          id: entity.id?.toString(),
          title: entity.title || null,
          username: entity.username || null,
          membersCount: entity.participantsCount || null,
          verified: entity.verified || false,
        };
      } else if (className === 'Chat') {
        result = {
          type: 'group',
          id: entity.id?.toString(),
          title: entity.title || null,
          membersCount: entity.participantsCount || null,
        };
      } else {
        result = {
          type: className,
          id: entity.id?.toString(),
        };
      }

      log.debug(`Resolved: ${result.type} ${result.id}`);

      return JSON.stringify(result);
    } catch (error) {
      log.error('Error resolving username:', (error as Error).message);
      throw error;
    }
  }
};

