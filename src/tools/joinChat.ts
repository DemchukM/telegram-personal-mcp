import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for JoinChat parameters
 */
export const JoinChatParamsSchema = z.object({
  link: z.string().min(1).describe('Invite link (t.me/joinchat/xxx or t.me/+xxx), public username (@channel), or channel/group username without @'),
});

/**
 * Join Chat Tool - Join a group or channel
 */
export const joinChatTool: Tool<undefined, typeof JoinChatParamsSchema> = {
  name: "joinChat",
  description: "Join a Telegram group or channel by invite link, t.me link, or public username.",
  parameters: JoinChatParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Joining chat", { link: args.link });

    const validArgs = JoinChatParamsSchema.parse(args);
    const client = await createClient();

    try {
      const link = validArgs.link.trim();

      // Private invite link (t.me/joinchat/xxx or t.me/+xxx)
      const inviteHash = extractInviteHash(link);
      if (inviteHash) {
        const result = await client.invoke(
          new Api.messages.ImportChatInvite({ hash: inviteHash })
        );

        const chat = (result as any).chats?.[0];
        return JSON.stringify({
          success: true,
          type: 'invite',
          chatId: chat?.id?.toString(),
          title: chat?.title || null,
        });
      }

      // Public username — resolve and join
      const username = link.startsWith('@') ? link.slice(1) : link;
      const entity = await client.getEntity(username);
      const inputChannel = await client.getInputEntity(entity);

      await client.invoke(
        new Api.channels.JoinChannel({
          channel: inputChannel as any,
        })
      );

      const e = entity as any;
      return JSON.stringify({
        success: true,
        type: 'public',
        chatId: e.id?.toString(),
        title: e.title || [e.firstName, e.lastName].filter(Boolean).join(' ') || null,
        username: e.username || null,
      });
    } catch (error) {
      log.error('Error joining chat:', (error as Error).message);
      throw error;
    }
  }
};

/**
 * Extract invite hash from various link formats
 */
function extractInviteHash(link: string): string | null {
  // t.me/joinchat/HASH
  const joinMatch = link.match(/(?:t\.me|telegram\.me)\/joinchat\/([a-zA-Z0-9_-]+)/);
  if (joinMatch) return joinMatch[1];

  // t.me/+HASH
  const plusMatch = link.match(/(?:t\.me|telegram\.me)\/\+([a-zA-Z0-9_-]+)/);
  if (plusMatch) return plusMatch[1];

  // Raw hash starting with + (no URL)
  if (link.startsWith('+')) return link.slice(1);

  return null;
}

