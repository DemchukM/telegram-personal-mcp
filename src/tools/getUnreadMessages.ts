import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for GetUnreadMessages parameters
 */
export const GetUnreadMessagesParamsSchema = z.object({
  dialogId: z.string().optional().describe('ID of a specific dialog to get unread messages from. If omitted, returns unread messages from all dialogs.'),
  dialogLimit: z.number().min(1).max(50).optional().default(10).describe('Maximum number of dialogs to scan when dialogId is not specified (1-50, default 10)'),
  messageLimit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of unread messages to retrieve per dialog (1-100, default 20)'),
});

/**
 * Get Unread Messages Tool - Fetch unread messages from one or multiple dialogs
 */
export const getUnreadMessagesTool: Tool<undefined, typeof GetUnreadMessagesParamsSchema> = {
  name: "getUnreadMessages",
  description: "Get unread messages. If dialogId is provided, returns unread messages from that dialog. Otherwise, scans recent dialogs and returns unread messages grouped by dialog.",
  parameters: GetUnreadMessagesParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Retrieving unread messages", args);

    const validArgs = GetUnreadMessagesParamsSchema.parse(args);
    const client = await createClient();

    try {
      // If specific dialog requested, fetch just that one
      if (validArgs.dialogId) {
        const dialogId = bigInt(validArgs.dialogId);

        // Find the dialog to get unread count
        const dialogs = await client.getDialogs({ limit: 100 });
        const dialog = dialogs.find(d => d.id && d.id.eq(dialogId));

        if (!dialog || dialog.unreadCount === 0) {
          return JSON.stringify({ dialogs: [], totalUnread: 0 });
        }

        const limit = Math.min(dialog.unreadCount, validArgs.messageLimit);
        const messages = await client.getMessages(dialogId, { limit });

        const items = messages.map((msg: any) => ({
          id: msg.id,
          date: msg.date,
          message: msg.message,
          fromId: msg.fromId?.userId?.toString() || msg.fromId?.channelId?.toString() || null,
          replyToMsgId: msg.replyTo?.replyToMsgId || null,
          out: msg.out,
        }));

        return JSON.stringify({
          dialogs: [{
            dialogId: dialog.id?.toString(),
            name: dialog.name || dialog.title,
            unreadCount: dialog.unreadCount,
            messages: items,
          }],
          totalUnread: dialog.unreadCount,
        });
      }

      // Otherwise scan multiple dialogs
      const dialogs = await client.getDialogs({ limit: 100 });
      const unreadDialogs = dialogs
        .filter(d => d.unreadCount > 0)
        .slice(0, validArgs.dialogLimit);

      log.debug(`Found ${unreadDialogs.length} dialogs with unread messages`);

      const result: object[] = [];
      let totalUnread = 0;

      for (const dialog of unreadDialogs) {
        const limit = Math.min(dialog.unreadCount, validArgs.messageLimit);
        totalUnread += dialog.unreadCount;

        try {
          const messages = await client.getMessages(dialog.id!, { limit });

          const items = messages.map((msg: any) => ({
            id: msg.id,
            date: msg.date,
            message: msg.message,
            fromId: msg.fromId?.userId?.toString() || msg.fromId?.channelId?.toString() || null,
            replyToMsgId: msg.replyTo?.replyToMsgId || null,
            out: msg.out,
          }));

          result.push({
            dialogId: dialog.id?.toString(),
            name: dialog.name || dialog.title,
            unreadCount: dialog.unreadCount,
            messages: items,
          });
        } catch (err) {
          log.error(`Error fetching messages from dialog ${dialog.title}:`, (err as Error).message);
        }
      }

      return JSON.stringify({
        dialogs: result,
        totalDialogs: result.length,
        totalUnread,
      });
    } catch (error) {
      log.error('Error getting unread messages:', (error as Error).message);
      throw error;
    }
  }
};

