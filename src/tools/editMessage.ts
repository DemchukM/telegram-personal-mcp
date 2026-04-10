import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for EditMessage parameters
 */
export const EditMessageParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog containing the message'),
  messageId: z.number().describe('ID of the message to edit'),
  text: z.string().min(1).describe('New text content for the message'),
});

/**
 * Edit Message Tool - Edit an existing message
 */
export const editMessageTool: Tool<undefined, typeof EditMessageParamsSchema> = {
  name: "editMessage",
  description: "Edit an existing text message in a Telegram dialog, chat or channel. Only your own messages can be edited.",
  parameters: EditMessageParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Editing message", { dialogId: args.dialogId, messageId: args.messageId });

    const validArgs = EditMessageParamsSchema.parse(args);
    const client = await createClient();

    try {
      const dialogId = bigInt(validArgs.dialogId);

      const result = await client.editMessage(dialogId, {
        message: validArgs.messageId,
        text: validArgs.text,
      });

      log.debug(`Message edited, id=${validArgs.messageId}`);

      return JSON.stringify({
        id: result.id,
        date: result.date,
        message: result.message,
        editDate: (result as any).editDate,
      });
    } catch (error) {
      log.error('Error editing message:', (error as Error).message);
      throw error;
    }
  }
};

