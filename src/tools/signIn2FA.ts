import { Tool } from 'fastmcp';
import { z } from 'zod';
import { Api } from 'telegram';
import { computeCheck } from 'telegram/Password.js';

import { createClient, loadTelegramSettings } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

export const SignIn2FAParamsSchema = z.object({
  password: z.string().min(1).describe('Your Telegram 2FA password'),
});

/**
 * Sign In 2FA Tool — Step 3 (optional) of Telegram sign-in.
 * Submits the Two-Factor Authentication password when required.
 */
export const signIn2FATool: Tool<undefined, typeof SignIn2FAParamsSchema> = {
  name: 'signIn2FA',
  description:
    'Step 3 of Telegram sign-in (only if 2FA is enabled). Submit your Two-Factor Authentication password to complete the sign-in.',
  parameters: SignIn2FAParamsSchema,
  execute: async (args, { log }) => {
    logger.info('Submitting 2FA password');

    const { apiId, apiHash } = loadTelegramSettings();
    const client = await createClient(apiId, apiHash);

    try {
      const passSrpRes = await client.invoke(new Api.account.GetPassword());
      const passSrpCheck = await computeCheck(passSrpRes, args.password);

      await client.invoke(
        new Api.auth.CheckPassword({
          password: passSrpCheck,
        }),
      );

      const user = await client.getMe();
      const username = user?.username || user?.firstName || 'unknown';

      log.info(`Signed in as ${username} (with 2FA)`);

      return JSON.stringify({
        success: true,
        username,
        message: `Successfully signed in as ${username} (2FA verified)!`,
      });
    } catch (error) {
      log.error('Error submitting 2FA password:', (error as Error).message);
      throw error;
    }
  },
};

