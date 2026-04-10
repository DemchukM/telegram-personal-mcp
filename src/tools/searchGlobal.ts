import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for SearchGlobal parameters
 */
export const SearchGlobalParamsSchema = z.object({
  query: z.string().min(1).describe('Search query text'),
  limit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of results (1-100, default 20)'),
  offsetDate: z.number().optional().default(0).describe('Offset date (unix timestamp) for pagination'),
  offsetId: z.number().optional().default(0).describe('Offset message ID for pagination'),
});

/**
 * Search Global Tool - Search messages across all chats
 */
export const searchGlobalTool: Tool<undefined, typeof SearchGlobalParamsSchema> = {
  name: "searchGlobal",
  description: "Search for messages across all Telegram chats, groups and channels. Returns matching messages with their dialog context.",
  parameters: SearchGlobalParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Searching globally", { query: args.query });

    const validArgs = SearchGlobalParamsSchema.parse(args);
    const client = await createClient();

    try {
      const result = await client.invoke(
        new Api.messages.SearchGlobal({
          q: validArgs.query,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: 0,
          maxDate: 0,
          offsetRate: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          offsetId: validArgs.offsetId,
          limit: validArgs.limit,
        })
      );

      // Build a map of chats/users for context
      const entities = new Map<string, any>();
      for (const user of (result as any).users || []) {
        entities.set(user.id?.toString(), {
          type: 'user',
          name: [user.firstName, user.lastName].filter(Boolean).join(' '),
          username: user.username,
        });
      }
      for (const chat of (result as any).chats || []) {
        entities.set(chat.id?.toString(), {
          type: chat.className === 'Channel' ? (chat.megagroup ? 'supergroup' : 'channel') : 'group',
          name: chat.title,
          username: chat.username,
        });
      }

      const messages = ((result as any).messages || []).map((msg: any) => {
        const peerId = msg.peerId?.userId?.toString()
          || msg.peerId?.channelId?.toString()
          || msg.peerId?.chatId?.toString()
          || null;

        return {
          id: msg.id,
          date: msg.date,
          message: msg.message,
          fromId: msg.fromId?.userId?.toString() || msg.fromId?.channelId?.toString() || null,
          peerId,
          peerInfo: peerId ? entities.get(peerId) || null : null,
          views: msg.views,
          forwards: msg.forwards,
        };
      });

      log.debug(`Global search found ${messages.length} messages`);

      // Pagination cursor
      const lastMsg = messages[messages.length - 1];
      const pagination = lastMsg
        ? { offsetId: lastMsg.id, offsetDate: lastMsg.date, hasMore: messages.length === validArgs.limit }
        : { hasMore: false };

      return JSON.stringify({ messages, total: messages.length, pagination });
    } catch (error) {
      log.error('Error in global search:', (error as Error).message);
      throw error;
    }
  }
};

