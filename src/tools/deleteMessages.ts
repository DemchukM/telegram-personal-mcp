import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for DeleteMessages parameters
 */
export const DeleteMessagesParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog containing the messages'),
  messageIds: z.array(z.number()).min(1).describe('Array of message IDs to delete'),
  revoke: z.boolean().optional().default(true).describe('Whether to delete for everyone (true) or just for yourself (false). Default: true'),
});

/**
 * Delete Messages Tool - Delete one or more messages
 */
export const deleteMessagesTool: Tool<undefined, typeof DeleteMessagesParamsSchema> = {
  name: "deleteMessages",
  description: "Delete one or more messages from a Telegram dialog, chat or channel. By default deletes for everyone.",
  parameters: DeleteMessagesParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Deleting messages", { dialogId: args.dialogId, count: args.messageIds.length });

    const validArgs = DeleteMessagesParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      // Try channel delete first (for channels and supergroups)
      try {
        await client.invoke(
          new Api.channels.DeleteMessages({
            channel: peer as any,
            id: validArgs.messageIds,
          })
        );
      } catch {
        // Fallback to regular delete (for private chats and basic groups)
        await client.invoke(
          new Api.messages.DeleteMessages({
            id: validArgs.messageIds,
            revoke: validArgs.revoke,
          })
        );
      }

      log.debug(`Deleted ${validArgs.messageIds.length} messages`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
        deletedIds: validArgs.messageIds,
        count: validArgs.messageIds.length,
      });
    } catch (error) {
      log.error('Error deleting messages:', (error as Error).message);
      throw error;
    }
  }
};

