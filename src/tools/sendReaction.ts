import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for SendReaction parameters
 */
export const SendReactionParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog containing the message'),
  messageId: z.number().describe('ID of the message to react to'),
  emoji: z.string().optional().describe('Emoji reaction to send (e.g. "👍", "❤️", "🔥"). Omit to remove your reaction.'),
  big: z.boolean().optional().default(false).describe('Whether to send a big/animated reaction (default: false)'),
});

/**
 * Send Reaction Tool - React to a message with an emoji
 */
export const sendReactionTool: Tool<undefined, typeof SendReactionParamsSchema> = {
  name: "sendReaction",
  description: "Send an emoji reaction to a Telegram message (e.g. 👍, ❤️, 🔥). Omit emoji to remove your reaction.",
  parameters: SendReactionParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Sending reaction", { dialogId: args.dialogId, messageId: args.messageId, emoji: args.emoji });

    const validArgs = SendReactionParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      const reaction = validArgs.emoji
        ? [new Api.ReactionEmoji({ emoticon: validArgs.emoji })]
        : [];

      await client.invoke(
        new Api.messages.SendReaction({
          peer,
          msgId: validArgs.messageId,
          big: validArgs.big,
          reaction,
        })
      );

      const action = validArgs.emoji ? `reacted with ${validArgs.emoji}` : 'removed reaction';
      log.debug(`Message ${validArgs.messageId}: ${action}`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
        messageId: validArgs.messageId,
        emoji: validArgs.emoji || null,
        action,
      });
    } catch (error) {
      log.error('Error sending reaction:', (error as Error).message);
      throw error;
    }
  }
};

