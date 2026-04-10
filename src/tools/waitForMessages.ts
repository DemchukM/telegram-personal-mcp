import { Tool } from 'fastmcp';
import bigInt from 'big-integer';
import { z } from 'zod';
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for WaitForMessages parameters
 */
export const WaitForMessagesParamsSchema = z.object({
  timeout: z.number().min(1).max(60).optional().default(30)
    .describe('How many seconds to wait for new messages (1-60, default 30)'),
  dialogId: z.string().optional()
    .describe('If provided, only listen for messages in this specific dialog'),
  incoming: z.boolean().optional().default(true)
    .describe('Whether to listen for incoming messages (default true)'),
  outgoing: z.boolean().optional().default(false)
    .describe('Whether to listen for outgoing messages (default false)'),
  pattern: z.string().optional()
    .describe('Optional regex pattern to filter messages by text content'),
});

/**
 * Wait For Messages Tool — long-polling tool that subscribes to
 * Telegram real-time updates (MTProto) and returns when new messages
 * arrive or the timeout expires.
 *
 * This is the MCP-compatible way to "subscribe" to incoming messages:
 * the AI client calls this tool repeatedly to receive events.
 */
export const waitForMessagesTool: Tool<undefined, typeof WaitForMessagesParamsSchema> = {
  name: "waitForMessages",
  description: "Long-poll for new Telegram messages in real-time. Blocks until new message(s) arrive or timeout expires. Use this to 'subscribe' to incoming messages — call it in a loop for continuous monitoring.",
  parameters: WaitForMessagesParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Waiting for new messages", args);

    const validArgs = WaitForMessagesParamsSchema.parse(args);
    const client = await createClient();

    const collected: object[] = [];

    // Build event filter options
    const eventFilter: {
      incoming?: boolean;
      outgoing?: boolean;
      chats?: ReturnType<typeof bigInt>[];
      pattern?: RegExp;
    } = {};

    if (validArgs.incoming && !validArgs.outgoing) {
      eventFilter.incoming = true;
    } else if (validArgs.outgoing && !validArgs.incoming) {
      eventFilter.outgoing = true;
    }

    if (validArgs.dialogId) {
      eventFilter.chats = [bigInt(validArgs.dialogId)];
    }

    if (validArgs.pattern) {
      eventFilter.pattern = new RegExp(validArgs.pattern);
    }

    return new Promise<string>((resolve) => {
      const handler = async (event: NewMessageEvent) => {
        try {
          const msg = event.message;
          const senderId = msg.senderId?.toString() || null;
          const chatId = msg.chatId?.toString() || msg.peerId?.toString() || null;

          collected.push({
            id: msg.id,
            date: msg.date,
            message: msg.message,
            fromId: senderId,
            chatId: chatId,
            isPrivate: event.isPrivate,
            isGroup: event.isGroup,
            isChannel: event.isChannel,
            replyToMsgId: msg.replyTo?.replyToMsgId || null,
            out: msg.out,
          });

          log.info(`New message received: id=${msg.id}, from=${senderId}`);
        } catch (err) {
          log.error('Error processing event:', (err as Error).message);
        }
      };

      // Subscribe to new message events
      client.addEventHandler(handler, new NewMessage(eventFilter));

      // Set timeout to resolve with whatever we collected
      const timer = setTimeout(() => {
        // Remove event handler
        client.removeEventHandler(handler, new NewMessage(eventFilter));

        resolve(JSON.stringify({
          messages: collected,
          count: collected.length,
          timedOut: collected.length === 0,
        }));
      }, validArgs.timeout * 1000);

      // If we get at least one message, wait a short grace period
      // for any burst messages, then resolve early
      const checkEarly = setInterval(() => {
        if (collected.length > 0) {
          // Wait 2 more seconds for burst messages, then resolve
          clearInterval(checkEarly);
          clearTimeout(timer);

          setTimeout(() => {
            client.removeEventHandler(handler, new NewMessage(eventFilter));

            resolve(JSON.stringify({
              messages: collected,
              count: collected.length,
              timedOut: false,
            }));
          }, 2000);
        }
      }, 500);

      // Clean up interval on timeout
      setTimeout(() => clearInterval(checkEarly), validArgs.timeout * 1000);
    });
  }
};

