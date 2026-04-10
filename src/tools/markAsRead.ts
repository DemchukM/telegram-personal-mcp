import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for MarkAsRead parameters
 */
export const MarkAsReadParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog to mark messages as read'),
  maxId: z.number().optional().describe('Mark messages up to this ID as read. If omitted, marks all messages as read.'),
});

/**
 * Mark As Read Tool - Mark messages in a dialog as read
 */
export const markAsReadTool: Tool<undefined, typeof MarkAsReadParamsSchema> = {
  name: "markAsRead",
  description: "Mark messages in a Telegram dialog as read. Can mark all messages or up to a specific message ID.",
  parameters: MarkAsReadParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Marking messages as read", args);

    const validArgs = MarkAsReadParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      // Use ReadHistory for users/groups, ReadHistory for channels
      const maxId = validArgs.maxId || 0; // 0 means all

      await client.invoke(
        new Api.messages.ReadHistory({
          peer,
          maxId,
        })
      );

      log.debug(`Marked messages as read in dialog ${validArgs.dialogId}`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
        maxId: maxId || 'all',
      });
    } catch (error) {
      // If it's a channel, try the channel-specific API
      if ((error as any).errorMessage === 'PEER_ID_INVALID' || (error as any).className === 'RPCError') {
        try {
          const channel = await client.getInputEntity(bigInt(validArgs.dialogId));
          await client.invoke(
            new Api.channels.ReadHistory({
              channel: channel as any,
              maxId: validArgs.maxId || 0,
            })
          );

          log.debug(`Marked channel messages as read in dialog ${validArgs.dialogId}`);
          return JSON.stringify({
            success: true,
            dialogId: validArgs.dialogId,
            maxId: validArgs.maxId || 'all',
          });
        } catch (channelError) {
          log.error('Error marking channel messages as read:', (channelError as Error).message);
          throw channelError;
        }
      }

      log.error('Error marking messages as read:', (error as Error).message);
      throw error;
    }
  }
};

