import { Tool } from 'fastmcp';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for GetMe parameters (none required)
 */
export const GetMeParamsSchema = z.object({});

/**
 * Get Me Tool - Return current authenticated user info
 */
export const getMeTool: Tool<undefined, typeof GetMeParamsSchema> = {
  name: "getMe",
  description: "Get information about the currently authenticated Telegram user. Returns user ID, name, username, phone, and premium status.",
  parameters: GetMeParamsSchema,
  execute: async (_args, { log }) => {
    logger.info("Getting current user info");

    const client = await createClient();

    try {
      const me = await client.getMe();

      const result = {
        id: me.id?.toString(),
        firstName: me.firstName || null,
        lastName: me.lastName || null,
        username: me.username || null,
        phone: me.phone || null,
        bot: me.bot || false,
        premium: (me as any).premium || false,
      };

      log.debug(`Current user: ${result.username || result.firstName}`);

      return JSON.stringify(result);
    } catch (error) {
      log.error('Error getting current user:', (error as Error).message);
      throw error;
    }
  }
};

