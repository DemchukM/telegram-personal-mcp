import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for SearchDialogs parameters
 */
export const SearchDialogsParamsSchema = z.object({
  query: z.string().min(1).describe('Search query to find dialogs, users, chats or channels by name'),
  limit: z.number().min(1).max(50).optional().default(20).describe('Maximum number of results to return (1-50, default 20)'),
});

/**
 * Helper to extract a readable entity from the API result
 */
function mapEntity(entity: any): object {
  return {
    id: entity.id?.toString(),
    name: [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.title || '',
    username: entity.username || null,
    type: entity.className, // 'User', 'Chat', 'Channel'
    isBot: entity.bot || false,
    phone: entity.phone || null,
  };
}

/**
 * Search Dialogs Tool - Search for users, chats and channels by name
 */
export const searchDialogsTool: Tool<undefined, typeof SearchDialogsParamsSchema> = {
  name: "searchDialogs",
  description: "Search for Telegram dialogs, users, chats and channels by name or username. Returns matching results with their IDs so you can then use listMessages to read messages.",
  parameters: SearchDialogsParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Searching dialogs", args);

    const validArgs = SearchDialogsParamsSchema.parse(args);
    const client = await createClient();

    try {
      const result = await client.invoke(
        new Api.contacts.Search({
          q: validArgs.query,
          limit: validArgs.limit,
        })
      );

      const users = (result.users || []).map(mapEntity);
      const chats = (result.chats || []).map(mapEntity);

      log.debug(`Search found ${users.length} users and ${chats.length} chats`);

      return JSON.stringify({
        users,
        chats,
        totalUsers: users.length,
        totalChats: chats.length,
      });
    } catch (error) {
      log.error('Error searching dialogs:', (error as Error).message);
      throw error;
    }
  }
};

