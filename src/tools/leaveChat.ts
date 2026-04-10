import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for LeaveChat parameters
 */
export const LeaveChatParamsSchema = z.object({
  dialogId: z.string().describe('ID of the group or channel to leave'),
  deleteHistory: z.boolean().optional().default(false).describe('Also delete chat history for yourself (default: false)'),
});

/**
 * Leave Chat Tool - Leave a group or channel
 */
export const leaveChatTool: Tool<undefined, typeof LeaveChatParamsSchema> = {
  name: "leaveChat",
  description: "Leave a Telegram group or channel.",
  parameters: LeaveChatParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Leaving chat", { dialogId: args.dialogId });

    const validArgs = LeaveChatParamsSchema.parse(args);
    const client = await createClient();

    try {
      const entity = await client.getEntity(bigInt(validArgs.dialogId));
      const className = (entity as any).className;

      if (className === 'Channel') {
        const inputChannel = await client.getInputEntity(bigInt(validArgs.dialogId));
        await client.invoke(
          new Api.channels.LeaveChannel({
            channel: inputChannel as any,
          })
        );
      } else if (className === 'Chat') {
        // For basic groups, use DeleteChatUser with self
        const me = await client.getMe();
        await client.invoke(
          new Api.messages.DeleteChatUser({
            chatId: bigInt(validArgs.dialogId),
            userId: new Api.InputUserSelf(),
            revokeHistory: validArgs.deleteHistory,
          })
        );
      } else {
        throw new Error('Cannot leave this type of dialog (not a group or channel)');
      }

      log.debug(`Left chat ${validArgs.dialogId}`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
      });
    } catch (error) {
      log.error('Error leaving chat:', (error as Error).message);
      throw error;
    }
  }
};

