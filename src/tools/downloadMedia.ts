import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

const DOWNLOADS_DIR = './downloads';

/**
 * Schema for DownloadMedia parameters
 */
export const DownloadMediaParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog containing the message with media'),
  messageId: z.number().describe('ID of the message with media to download'),
  outputPath: z.string().optional().describe('Custom output file path. If omitted, saves to ./downloads/ with auto-generated name'),
});

/**
 * Download Media Tool - Download media from a message
 */
export const downloadMediaTool: Tool<undefined, typeof DownloadMediaParamsSchema> = {
  name: "downloadMedia",
  description: "Download media (photo, video, document, audio) from a Telegram message to local disk. Saves to ./downloads/ by default.",
  parameters: DownloadMediaParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Downloading media", { dialogId: args.dialogId, messageId: args.messageId });

    const validArgs = DownloadMediaParamsSchema.parse(args);
    const client = await createClient();

    try {
      const dialogId = bigInt(validArgs.dialogId);

      // Get the message
      const messages = await client.getMessages(dialogId, {
        ids: [validArgs.messageId],
      });

      if (!messages || messages.length === 0) {
        throw new Error(`Message ${validArgs.messageId} not found`);
      }

      const message = messages[0];

      if (!message.media) {
        throw new Error(`Message ${validArgs.messageId} has no media`);
      }

      // Ensure download directory exists
      const outputDir = validArgs.outputPath
        ? path.dirname(validArgs.outputPath)
        : DOWNLOADS_DIR;

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Determine output path
      let outputFile = validArgs.outputPath;
      if (!outputFile) {
        // Auto-generate filename based on media type
        const mediaType = (message.media as any).className || 'unknown';
        const ext = getExtension(message.media);
        outputFile = path.join(DOWNLOADS_DIR, `${validArgs.dialogId}_${validArgs.messageId}${ext}`);
      }

      // Download
      const buffer = await client.downloadMedia(message, {}) as Buffer;

      if (!buffer) {
        throw new Error('Download returned empty result');
      }

      fs.writeFileSync(outputFile, buffer);

      const stats = fs.statSync(outputFile);

      log.debug(`Media downloaded to ${outputFile} (${stats.size} bytes)`);

      return JSON.stringify({
        success: true,
        outputPath: path.resolve(outputFile),
        size: stats.size,
        messageId: validArgs.messageId,
      });
    } catch (error) {
      log.error('Error downloading media:', (error as Error).message);
      throw error;
    }
  }
};

/**
 * Guess file extension from media type
 */
function getExtension(media: any): string {
  const className = media?.className;
  if (className === 'MessageMediaPhoto') return '.jpg';
  if (className === 'MessageMediaDocument') {
    const doc = media.document;
    if (doc) {
      const fileNameAttr = doc.attributes?.find((a: any) => a.className === 'DocumentAttributeFilename');
      if (fileNameAttr?.fileName) {
        return path.extname(fileNameAttr.fileName);
      }
      // Guess by mime
      const mime = doc.mimeType || '';
      if (mime.startsWith('video/')) return '.mp4';
      if (mime.startsWith('audio/')) return '.mp3';
      if (mime === 'image/gif') return '.gif';
      if (mime === 'image/webp') return '.webp';
      if (mime.startsWith('image/')) return '.jpg';
    }
    return '.bin';
  }
  return '.bin';
}

