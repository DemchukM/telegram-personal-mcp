import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for InviteToChat parameters
 */
export const InviteToChatParamsSchema = z.object({
  dialogId: z.string().describe('ID of the group or channel to invite users to'),
  userIds: z.array(z.string()).min(1).describe('Array of user IDs or @usernames to invite'),
});

/**
 * Invite To Chat Tool - Invite users to a group or channel
 */
export const inviteToChatTool: Tool<undefined, typeof InviteToChatParamsSchema> = {
  name: "inviteToChat",
  description: "Invite one or more users to a Telegram group or channel by user ID or @username.",
  parameters: InviteToChatParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Inviting users to chat", { dialogId: args.dialogId, count: args.userIds.length });

    const validArgs = InviteToChatParamsSchema.parse(args);
    const client = await createClient();

    try {
      const entity = await client.getEntity(bigInt(validArgs.dialogId));
      const className = (entity as any).className;

      // Resolve all user entities
      const users: Api.TypeInputUser[] = [];
      for (const userId of validArgs.userIds) {
        const userEntity = userId.startsWith('@')
          ? await client.getEntity(userId)
          : await client.getEntity(bigInt(userId));
        const inputUser = await client.getInputEntity(userEntity);
        users.push(inputUser as any);
      }

      if (className === 'Channel') {
        const inputChannel = await client.getInputEntity(bigInt(validArgs.dialogId));
        await client.invoke(
          new Api.channels.InviteToChannel({
            channel: inputChannel as any,
            users,
          })
        );
      } else if (className === 'Chat') {
        // Basic groups — must invite one at a time
        for (const user of users) {
          await client.invoke(
            new Api.messages.AddChatUser({
              chatId: bigInt(validArgs.dialogId),
              userId: user,
              fwdLimit: 100,
            })
          );
        }
      } else {
        throw new Error('Cannot invite users to this type of dialog');
      }

      log.debug(`Invited ${users.length} users to ${validArgs.dialogId}`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
        invitedCount: users.length,
      });
    } catch (error) {
      log.error('Error inviting users:', (error as Error).message);
      throw error;
    }
  }
};

