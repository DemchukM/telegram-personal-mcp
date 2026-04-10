import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for ForwardMessages parameters
 */
export const ForwardMessagesParamsSchema = z.object({
  fromDialogId: z.string().describe('ID of the source dialog to forward messages from'),
  toDialogId: z.string().describe('ID of the destination dialog to forward messages to'),
  messageIds: z.array(z.number()).min(1).describe('Array of message IDs to forward'),
  silent: z.boolean().optional().default(false).describe('Send without notification sound (default: false)'),
  dropAuthor: z.boolean().optional().default(false).describe('Forward without quoting the original author (default: false)'),
});

/**
 * Forward Messages Tool - Forward messages between dialogs
 */
export const forwardMessagesTool: Tool<undefined, typeof ForwardMessagesParamsSchema> = {
  name: "forwardMessages",
  description: "Forward one or more messages from one Telegram dialog to another. Supports silent forwarding and dropping the original author attribution.",
  parameters: ForwardMessagesParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Forwarding messages", {
      from: args.fromDialogId,
      to: args.toDialogId,
      count: args.messageIds.length,
    });

    const validArgs = ForwardMessagesParamsSchema.parse(args);
    const client = await createClient();

    try {
      const fromPeer = bigInt(validArgs.fromDialogId);
      const toPeer = bigInt(validArgs.toDialogId);

      const result = await client.forwardMessages(toPeer, {
        messages: validArgs.messageIds,
        fromPeer,
        silent: validArgs.silent,
        dropAuthor: validArgs.dropAuthor,
      });

      const forwarded = Array.isArray(result) ? result : [result];
      const items = forwarded.map((msg: any) => ({
        id: msg.id,
        date: msg.date,
        message: msg.message,
      }));

      log.debug(`Forwarded ${items.length} messages`);

      return JSON.stringify({
        success: true,
        forwarded: items,
        count: items.length,
      });
    } catch (error) {
      log.error('Error forwarding messages:', (error as Error).message);
      throw error;
    }
  }
};

