import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for PinMessage parameters
 */
export const PinMessageParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog containing the message'),
  messageId: z.number().describe('ID of the message to pin or unpin'),
  unpin: z.boolean().optional().default(false).describe('Set to true to unpin the message (default: false = pin)'),
  silent: z.boolean().optional().default(false).describe('Pin without sending a notification (default: false)'),
  pmOneside: z.boolean().optional().default(false).describe('In private chats, pin only for yourself (default: false)'),
});

/**
 * Pin Message Tool - Pin or unpin a message in a dialog
 */
export const pinMessageTool: Tool<undefined, typeof PinMessageParamsSchema> = {
  name: "pinMessage",
  description: "Pin or unpin a message in a Telegram dialog, group or channel. Supports silent pinning and one-sided pins in private chats.",
  parameters: PinMessageParamsSchema,
  execute: async (args, { log }) => {
    logger.info(args.unpin ? "Unpinning message" : "Pinning message", {
      dialogId: args.dialogId,
      messageId: args.messageId,
    });

    const validArgs = PinMessageParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      await client.invoke(
        new Api.messages.UpdatePinnedMessage({
          peer,
          id: validArgs.messageId,
          unpin: validArgs.unpin,
          silent: validArgs.silent,
          pmOneside: validArgs.pmOneside,
        })
      );

      const action = validArgs.unpin ? 'unpinned' : 'pinned';
      log.debug(`Message ${validArgs.messageId} ${action}`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
        messageId: validArgs.messageId,
        action,
      });
    } catch (error) {
      log.error('Error pinning message:', (error as Error).message);
      throw error;
    }
  }
};

