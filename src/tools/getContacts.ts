import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for GetContacts parameters
 */
export const GetContactsParamsSchema = z.object({
  search: z.string().optional().default('').describe('Optional search query to filter contacts by name'),
});

/**
 * Get Contacts Tool - List all contacts
 */
export const getContactsTool: Tool<undefined, typeof GetContactsParamsSchema> = {
  name: "getContacts",
  description: "Get the list of all Telegram contacts. Optionally filter by name.",
  parameters: GetContactsParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Getting contacts", { search: args.search });

    const validArgs = GetContactsParamsSchema.parse(args);
    const client = await createClient();

    try {
      let result;

      if (validArgs.search) {
        // Use contacts.search for filtered results
        result = await client.invoke(
          new Api.contacts.Search({
            q: validArgs.search,
            limit: 100,
          })
        );

        const contacts = (result.users || []).map((user: any) => ({
          id: user.id?.toString(),
          firstName: user.firstName || null,
          lastName: user.lastName || null,
          username: user.username || null,
          phone: user.phone || null,
          bot: user.bot || false,
        }));

        log.debug(`Found ${contacts.length} contacts matching "${validArgs.search}"`);

        return JSON.stringify({ contacts, total: contacts.length });
      }

      // Get all contacts
      const contactsResult = await client.invoke(
        new Api.contacts.GetContacts({ hash: bigInt(0) })
      );

      if (contactsResult instanceof Api.contacts.ContactsNotModified) {
        return JSON.stringify({ contacts: [], total: 0, notModified: true });
      }

      const contacts = (contactsResult.users || []).map((user: any) => ({
        id: user.id?.toString(),
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        username: user.username || null,
        phone: user.phone || null,
        bot: user.bot || false,
        mutual: contactsResult.contacts?.some(
          (c: any) => c.userId?.toString() === user.id?.toString() && c.mutual
        ) || false,
      }));

      log.debug(`Got ${contacts.length} contacts`);

      return JSON.stringify({ contacts, total: contacts.length });
    } catch (error) {
      log.error('Error getting contacts:', (error as Error).message);
      throw error;
    }
  }
};

