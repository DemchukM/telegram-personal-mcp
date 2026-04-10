import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for GetPinnedMessages parameters
 */
export const GetPinnedMessagesParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog to get pinned messages from'),
  limit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of pinned messages to retrieve (1-100, default 20)'),
});

/**
 * Get Pinned Messages Tool - Fetch pinned messages from a dialog
 */
export const getPinnedMessagesTool: Tool<undefined, typeof GetPinnedMessagesParamsSchema> = {
  name: "getPinnedMessages",
  description: "Get all pinned messages from a Telegram dialog, group or channel.",
  parameters: GetPinnedMessagesParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Getting pinned messages", { dialogId: args.dialogId });

    const validArgs = GetPinnedMessagesParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      const result = await client.invoke(
        new Api.messages.Search({
          peer,
          q: '',
          filter: new Api.InputMessagesFilterPinned(),
          minDate: 0,
          maxDate: 0,
          offsetId: 0,
          addOffset: 0,
          limit: validArgs.limit,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        })
      );

      if (result instanceof Api.messages.MessagesNotModified) {
        return JSON.stringify({ messages: [], total: 0 });
      }

      const msgs = (result as any).messages || [];
      const items = msgs.map((msg: any) => ({
        id: msg.id,
        date: msg.date,
        message: msg.message,
        fromId: msg.fromId?.userId?.toString() || msg.fromId?.channelId?.toString() || null,
        views: msg.views,
        forwards: msg.forwards,
      }));

      log.debug(`Got ${items.length} pinned messages`);

      return JSON.stringify({
        messages: items,
        total: items.length,
      });
    } catch (error) {
      log.error('Error getting pinned messages:', (error as Error).message);
      throw error;
    }
  }
};

