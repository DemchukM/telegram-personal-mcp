import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for SendFile parameters
 */
export const SendFileParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog to send the file to'),
  file: z.string().min(1).describe('Path to local file or a URL to send'),
  caption: z.string().optional().describe('Optional caption text for the file'),
  forceDocument: z.boolean().optional().default(false).describe('Force sending as a document instead of auto-detecting type (default: false)'),
  replyToMessageId: z.number().optional().describe('ID of the message to reply to (optional)'),
});

/**
 * Send File Tool - Send a file, photo, or document to a dialog
 */
export const sendFileTool: Tool<undefined, typeof SendFileParamsSchema> = {
  name: "sendFile",
  description: "Send a file, photo, or document to a Telegram dialog. Accepts a local file path or URL. Telegram auto-detects the file type (photo, video, audio, document).",
  parameters: SendFileParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Sending file", { dialogId: args.dialogId, file: args.file });

    const validArgs = SendFileParamsSchema.parse(args);
    const client = await createClient();

    try {
      const dialogId = bigInt(validArgs.dialogId);

      const result = await client.sendFile(dialogId, {
        file: validArgs.file,
        caption: validArgs.caption,
        forceDocument: validArgs.forceDocument,
        replyTo: validArgs.replyToMessageId,
      });

      log.debug(`File sent, id=${result.id}`);

      return JSON.stringify({
        id: result.id,
        date: result.date,
        message: result.message || validArgs.caption || null,
        out: result.out,
      });
    } catch (error) {
      log.error('Error sending file:', (error as Error).message);
      throw error;
    }
  }
};

