import { Tool } from "fastmcp";
import bigInt from "big-integer";
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';


/**
 * Schema for ListMessages parameters
 */
export const ListMessagesParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog to list messages from'),
  limit: z.number().min(1).max(100).optional().default(50).describe('Maximum number of messages to retrieve (1-100, default 50)'),
  offsetId: z.number().optional().describe('Offset message ID for pagination — fetch messages older than this ID'),
  offsetDate: z.number().optional().describe('Offset date (unix timestamp) for pagination — fetch messages older than this date'),
  unread: z.boolean().optional().describe('Show only unread messages (caps limit to the unread count of the dialog)'),
  search: z.string().optional().describe('Search query to filter messages by text content'),
});

/**
 * List Messages Tool - Get messages from a specific dialog with pagination
 */
export const listMessagesTool: Tool<undefined, typeof ListMessagesParamsSchema> = {
  name: "listMessages",
  description: "List messages in a given dialog, chat or channel. Messages are returned newest-to-oldest. Supports pagination via offsetId/offsetDate, text search, and unread-only filtering.",
  parameters: ListMessagesParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Retrieving messages", args);

    const validArgs = ListMessagesParamsSchema.parse(args);
    const client = await createClient();

    try {
      const dialogId = bigInt(validArgs.dialogId);
      let limit = validArgs.limit;

      // If unread filter is enabled, cap the limit to the dialog's unread count
      if (validArgs.unread) {
        const dialogs = await client.getDialogs({ limit: 100 });
        const dialog = dialogs.find(d => d.id && d.id.eq(dialogId));
        if (dialog && dialog.unreadCount > 0) {
          limit = Math.min(dialog.unreadCount, limit);
          log.debug(`Unread filter: capping limit to ${limit} (dialog unreadCount=${dialog.unreadCount})`);
        } else {
          return JSON.stringify({ items: [], total: 0, pagination: { hasMore: false } });
        }
      }

      const messages = await client.getMessages(dialogId, {
        limit,
        offsetId: validArgs.offsetId,
        offsetDate: validArgs.offsetDate,
        search: validArgs.search,
      });

      log.debug(`Retrieved ${messages.length} messages`);

      const items = messages.map((msg: any) => ({
        id: msg.id,
        date: msg.date,
        message: msg.message,
        fromId: msg.fromId?.userId?.toString() || msg.fromId?.channelId?.toString() || null,
        replyToMsgId: msg.replyTo?.replyToMsgId || null,
        forwards: msg.forwards,
        views: msg.views,
        editDate: msg.editDate,
        out: msg.out,
      }));

      // Pagination cursor from the last (oldest) message
      const lastMsg = messages[messages.length - 1];
      const pagination = lastMsg
        ? { offsetId: lastMsg.id, offsetDate: lastMsg.date, hasMore: messages.length === limit }
        : { hasMore: false };

      return JSON.stringify({ items, total: items.length, pagination });
    } catch (error) {
      log.error('Error listing messages:', (error as Error).message);
      throw error;
    }
  }
};
