import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for GetUserInfo parameters
 */
export const GetUserInfoParamsSchema = z.object({
  userId: z.string().describe('User ID or username (with @ prefix) to get info about'),
});

/**
 * Get User Info Tool - Get detailed profile information about a user
 */
export const getUserInfoTool: Tool<undefined, typeof GetUserInfoParamsSchema> = {
  name: "getUserInfo",
  description: "Get detailed profile information about a Telegram user including bio, common chats count, profile photos count, and online status.",
  parameters: GetUserInfoParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Getting user info", { userId: args.userId });

    const validArgs = GetUserInfoParamsSchema.parse(args);
    const client = await createClient();

    try {
      // Resolve entity — supports both numeric IDs and @usernames
      const entity = validArgs.userId.startsWith('@')
        ? await client.getEntity(validArgs.userId)
        : await client.getEntity(bigInt(validArgs.userId));

      const inputUser = await client.getInputEntity(entity);

      const fullUser = await client.invoke(
        new Api.users.GetFullUser({
          id: inputUser as any,
        })
      );

      const user = fullUser.users[0] as any;
      const full = fullUser.fullUser;

      const result = {
        id: user?.id?.toString(),
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        username: user?.username || null,
        phone: user?.phone || null,
        bot: user?.bot || false,
        premium: user?.premium || false,
        verified: user?.verified || false,
        restricted: user?.restricted || false,
        bio: full?.about || null,
        commonChatsCount: full?.commonChatsCount || 0,
        blocked: full?.blocked || false,
        phoneCallsAvailable: full?.phoneCallsAvailable || false,
        videoCallsAvailable: full?.videoCallsAvailable || false,
      };

      log.debug(`Got user info: ${result.username || result.firstName}`);

      return JSON.stringify(result);
    } catch (error) {
      log.error('Error getting user info:', (error as Error).message);
      throw error;
    }
  }
};

