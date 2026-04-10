import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for SendMessage parameters
 */
export const SendMessageParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog (user, chat or channel) to send the message to'),
  message: z.string().min(1).describe('Text content of the message to send'),
  replyToMessageId: z.number().optional().describe('ID of the message to reply to (optional)'),
});

/**
 * Send Message Tool - Send a text message to a dialog
 */
export const sendMessageTool: Tool<undefined, typeof SendMessageParamsSchema> = {
  name: "sendMessage",
  description: "Send a text message to a Telegram dialog, chat or channel. Optionally reply to a specific message.",
  parameters: SendMessageParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Sending message", { dialogId: args.dialogId, replyTo: args.replyToMessageId });

    const validArgs = SendMessageParamsSchema.parse(args);
    const client = await createClient();

    try {
      const dialogId = bigInt(validArgs.dialogId);

      const result = await client.sendMessage(dialogId, {
        message: validArgs.message,
        replyTo: validArgs.replyToMessageId,
      });

      log.debug(`Message sent, id=${result.id}`);

      return JSON.stringify({
        id: result.id,
        date: result.date,
        message: result.message,
        out: result.out,
      });
    } catch (error) {
      log.error('Error sending message:', (error as Error).message);
      throw error;
    }
  }
};

