import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for GetDialogInfo parameters
 */
export const GetDialogInfoParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog (chat, channel or group) to get info about'),
});

/**
 * Get Dialog Info Tool - Get detailed info about a chat, channel or group
 */
export const getDialogInfoTool: Tool<undefined, typeof GetDialogInfoParamsSchema> = {
  name: "getDialogInfo",
  description: "Get detailed information about a Telegram chat, channel or group including description, member count, admins count, linked chat, and settings.",
  parameters: GetDialogInfoParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Getting dialog info", { dialogId: args.dialogId });

    const validArgs = GetDialogInfoParamsSchema.parse(args);
    const client = await createClient();

    try {
      const entity = await client.getEntity(bigInt(validArgs.dialogId));
      const className = (entity as any).className;

      // User entity — return user info
      if (className === 'User') {
        const user = entity as any;
        return JSON.stringify({
          type: 'user',
          id: user.id?.toString(),
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          username: user.username || null,
          phone: user.phone || null,
          bot: user.bot || false,
        });
      }

      // Channel or Supergroup
      if (className === 'Channel') {
        const inputChannel = await client.getInputEntity(bigInt(validArgs.dialogId));
        const fullChannel = await client.invoke(
          new Api.channels.GetFullChannel({
            channel: inputChannel as any,
          })
        );

        const channel = fullChannel.chats[0] as any;
        const full = fullChannel.fullChat as any;

        return JSON.stringify({
          type: channel.megagroup ? 'supergroup' : 'channel',
          id: channel.id?.toString(),
          title: channel.title || null,
          username: channel.username || null,
          description: full.about || null,
          membersCount: full.participantsCount || null,
          adminsCount: full.adminsCount || null,
          bannedCount: full.bannedCount || null,
          onlineCount: full.onlineCount || null,
          linkedChatId: full.linkedChatId?.toString() || null,
          slowmodeSeconds: full.slowmodeSeconds || null,
          verified: channel.verified || false,
          restricted: channel.restricted || false,
          scam: channel.scam || false,
          hasGeo: channel.hasGeo || false,
          createdDate: channel.date || null,
        });
      }

      // Basic group (Chat)
      if (className === 'Chat') {
        const fullChat = await client.invoke(
          new Api.messages.GetFullChat({
            chatId: bigInt(validArgs.dialogId),
          })
        );

        const chat = fullChat.chats[0] as any;
        const full = fullChat.fullChat as any;

        return JSON.stringify({
          type: 'group',
          id: chat.id?.toString(),
          title: chat.title || null,
          description: full.about || null,
          membersCount: chat.participantsCount || null,
          createdDate: chat.date || null,
        });
      }

      return JSON.stringify({ error: 'Unknown entity type', className });
    } catch (error) {
      log.error('Error getting dialog info:', (error as Error).message);
      throw error;
    }
  }
};

