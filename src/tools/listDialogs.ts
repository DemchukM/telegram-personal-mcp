import { Tool } from 'fastmcp';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for ListDialogs parameters
 */
export const ListDialogsParamsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of dialogs to retrieve (1-100, default 20)'),
  offsetDate: z.number().optional().describe('Offset date (unix timestamp) for pagination — use value from previous response'),
  offsetId: z.number().optional().describe('Offset message ID for pagination — use value from previous response'),
  unread: z.boolean().optional().describe('Show only unread dialogs'),
  archived: z.boolean().optional().describe('Include archived dialogs'),
  ignorePinned: z.boolean().optional().describe('Ignore pinned dialogs'),
});

/**
 * List Dialogs Tool - Get list of available dialogs, chats and channels with pagination
 */
export const listDialogsTool: Tool<undefined, typeof ListDialogsParamsSchema> = {
  name: "listDialogs",
  description: "List available dialogs, chats and channels. Supports pagination via offsetDate/offsetId returned in the response.",
  parameters: ListDialogsParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Retrieving dialogs", args);

    const validArgs = ListDialogsParamsSchema.parse(args);
    const client = await createClient();

    try {
      const dialogs = await client.getDialogs({
        archived: validArgs.archived || false,
        ignorePinned: validArgs.ignorePinned || false,
        limit: validArgs.limit,
        offsetDate: validArgs.offsetDate,
        offsetId: validArgs.offsetId,
      });

      log.debug(`Retrieved ${dialogs.length} dialogs`);

      const items: object[] = [];
      for (const dialog of dialogs) {
        if (validArgs.unread && dialog.unreadCount === 0) {
          continue;
        }

        items.push({
          id: dialog.id?.toString(),
          name: dialog.name,
          title: dialog.title,
          unreadCount: dialog.unreadCount,
          date: dialog.date,
          pinned: dialog.pinned,
          archived: dialog.folderId !== undefined,
          isUser: dialog.isUser,
          isGroup: dialog.isGroup,
          isChannel: dialog.isChannel,
        });
      }

      // Build pagination cursor from the last dialog
      const lastDialog = dialogs[dialogs.length - 1];
      const pagination = lastDialog
        ? { offsetDate: lastDialog.date, offsetId: lastDialog.message?.id, hasMore: dialogs.length === validArgs.limit }
        : { hasMore: false };

      return JSON.stringify({ items, total: items.length, pagination });
    } catch (error) {
      log.error('Error listing dialogs:', (error as Error).message);
      throw error;
    }
  }
};