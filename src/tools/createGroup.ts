import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for CreateGroup parameters
 */
export const CreateGroupParamsSchema = z.object({
  title: z.string().min(1).describe('Title (name) of the new group'),
  userIds: z.array(z.string()).optional().default([])
    .describe('Array of user IDs or @usernames to add as initial members. At least one user is required for basic groups.'),
  about: z.string().optional().default('')
    .describe('Optional group description / about text'),
  supergroup: z.boolean().optional().default(false)
    .describe('If true, creates a supergroup (megagroup) instead of a basic group. Supergroups support larger member limits, admin permissions, etc. Default: false (basic group).'),
});

/**
 * Create Group Tool - Create a new Telegram group or supergroup
 */
export const createGroupTool: Tool<undefined, typeof CreateGroupParamsSchema> = {
  name: "createGroup",
  description: "Create a new Telegram group or supergroup. Basic groups require at least one initial member. Supergroups can be created empty.",
  parameters: CreateGroupParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Creating group", { title: args.title, supergroup: args.supergroup });

    const validArgs = CreateGroupParamsSchema.parse(args);
    const client = await createClient();

    try {
      if (validArgs.supergroup) {
        // Create a supergroup (megagroup) via channels.CreateChannel
        const result = await client.invoke(
          new Api.channels.CreateChannel({
            title: validArgs.title,
            about: validArgs.about || '',
            megagroup: true, // supergroup, not a broadcast channel
          })
        );

        const chat = (result as any).chats?.[0];
        const chatId = chat?.id?.toString() || null;

        // Invite initial members if provided
        if (validArgs.userIds.length > 0 && chatId) {
          const users: Api.TypeInputUser[] = [];
          for (const userId of validArgs.userIds) {
            const userEntity = userId.startsWith('@')
              ? await client.getEntity(userId)
              : await client.getEntity(bigInt(userId));
            const inputUser = await client.getInputEntity(userEntity);
            users.push(inputUser as any);
          }

          const inputChannel = await client.getInputEntity(bigInt(chatId));
          await client.invoke(
            new Api.channels.InviteToChannel({
              channel: inputChannel as any,
              users,
            })
          );
        }

        log.debug(`Supergroup created: ${chat?.title}, id=${chatId}`);

        return JSON.stringify({
          success: true,
          type: 'supergroup',
          chatId,
          title: chat?.title || validArgs.title,
          about: validArgs.about || null,
          invitedCount: validArgs.userIds.length,
        });
      } else {
        // Create a basic group via messages.CreateChat
        // Basic groups require at least one user
        if (validArgs.userIds.length === 0) {
          throw new Error('Basic groups require at least one initial member in userIds. Use supergroup=true to create an empty group.');
        }

        const users: Api.TypeInputUser[] = [];
        for (const userId of validArgs.userIds) {
          const userEntity = userId.startsWith('@')
            ? await client.getEntity(userId)
            : await client.getEntity(bigInt(userId));
          const inputUser = await client.getInputEntity(userEntity);
          users.push(inputUser as any);
        }

        const result = await client.invoke(
          new Api.messages.CreateChat({
            title: validArgs.title,
            users,
          })
        );

        const chat = (result as any).chats?.[0];
        const chatId = chat?.id?.toString() || null;

        log.debug(`Basic group created: ${chat?.title}, id=${chatId}`);

        return JSON.stringify({
          success: true,
          type: 'basic_group',
          chatId,
          title: chat?.title || validArgs.title,
          invitedCount: users.length,
        });
      }
    } catch (error) {
      log.error('Error creating group:', (error as Error).message);
      throw error;
    }
  }
};

