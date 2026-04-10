import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for GetParticipants parameters
 */
export const GetParticipantsParamsSchema = z.object({
  dialogId: z.string().describe('ID of the group or channel to get participants from'),
  limit: z.number().min(1).max(200).optional().default(100).describe('Maximum number of participants to retrieve (1-200, default 100)'),
  offset: z.number().min(0).optional().default(0).describe('Offset for pagination (default 0)'),
  search: z.string().optional().default('').describe('Search query to filter participants by name'),
  filter: z.enum(['all', 'admins', 'bots', 'banned', 'kicked']).optional().default('all').describe('Filter participants by type (default: all)'),
});

/**
 * Map filter string to API filter class
 */
function getParticipantFilter(filter: string, search: string) {
  switch (filter) {
    case 'admins':
      return new Api.ChannelParticipantsAdmins();
    case 'bots':
      return new Api.ChannelParticipantsBots();
    case 'banned':
      return new Api.ChannelParticipantsBanned({ q: search });
    case 'kicked':
      return new Api.ChannelParticipantsKicked({ q: search });
    default:
      return new Api.ChannelParticipantsSearch({ q: search });
  }
}

/**
 * Get Participants Tool - List members of a group or channel
 */
export const getParticipantsTool: Tool<undefined, typeof GetParticipantsParamsSchema> = {
  name: "getParticipants",
  description: "List participants (members) of a Telegram group or channel. Supports filtering by admins, bots, banned users, and text search.",
  parameters: GetParticipantsParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Getting participants", { dialogId: args.dialogId, filter: args.filter });

    const validArgs = GetParticipantsParamsSchema.parse(args);
    const client = await createClient();

    try {
      const inputEntity = await client.getInputEntity(bigInt(validArgs.dialogId));

      const result = await client.invoke(
        new Api.channels.GetParticipants({
          channel: inputEntity as any,
          filter: getParticipantFilter(validArgs.filter, validArgs.search),
          offset: validArgs.offset,
          limit: validArgs.limit,
          hash: bigInt(0),
        })
      );

      if (result instanceof Api.channels.ChannelParticipantsNotModified) {
        return JSON.stringify({ participants: [], total: 0 });
      }

      const users = new Map<string, any>();
      for (const user of result.users) {
        const u = user as any;
        users.set(u.id?.toString(), {
          id: u.id?.toString(),
          firstName: u.firstName || null,
          lastName: u.lastName || null,
          username: u.username || null,
          bot: u.bot || false,
          premium: u.premium || false,
        });
      }

      const participants = result.participants.map((p: any) => ({
        userId: p.userId?.toString(),
        user: users.get(p.userId?.toString()) || null,
        role: p.className, // ChannelParticipant, ChannelParticipantAdmin, ChannelParticipantCreator, etc.
        date: p.date || null,
        adminRights: p.adminRights ? {
          changeInfo: p.adminRights.changeInfo,
          postMessages: p.adminRights.postMessages,
          editMessages: p.adminRights.editMessages,
          deleteMessages: p.adminRights.deleteMessages,
          banUsers: p.adminRights.banUsers,
          inviteUsers: p.adminRights.inviteUsers,
          pinMessages: p.adminRights.pinMessages,
          manageCall: p.adminRights.manageCall,
        } : null,
      }));

      log.debug(`Got ${participants.length} participants (total: ${result.count})`);

      return JSON.stringify({
        participants,
        total: result.count,
        count: participants.length,
        hasMore: validArgs.offset + participants.length < result.count,
      });
    } catch (error) {
      log.error('Error getting participants:', (error as Error).message);
      throw error;
    }
  }
};

