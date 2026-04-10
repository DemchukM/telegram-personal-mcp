import { Tool } from 'fastmcp';
import { z } from 'zod';
import { Api } from 'telegram';

import { createClient, loadTelegramSettings } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

export const SignInParamsSchema = z.object({
  phoneNumber: z.string().min(1).describe('Phone number used in sendCode step'),
  phoneCodeHash: z.string().min(1).describe('phoneCodeHash returned by sendCode'),
  phoneCode: z.string().min(1).describe('The login code received via Telegram'),
});

/**
 * Sign In Tool — Step 2 of Telegram sign-in.
 * Submits the auth code received on the phone.
 * If 2FA is enabled, returns a message asking to use signIn2FA tool.
 */
export const signInTool: Tool<undefined, typeof SignInParamsSchema> = {
  name: 'signIn',
  description:
    'Step 2 of Telegram sign-in. Submit the auth code received on your phone. If 2FA is enabled, you will be asked to use signIn2FA tool next.',
  parameters: SignInParamsSchema,
  execute: async (args, { log }) => {
    logger.info('Signing in with code');

    const { apiId, apiHash } = loadTelegramSettings();
    const client = await createClient(apiId, apiHash);

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: args.phoneNumber,
          phoneCodeHash: args.phoneCodeHash,
          phoneCode: args.phoneCode,
        }),
      );

      const user = await client.getMe();
      const username = user?.username || user?.firstName || 'unknown';

      log.info(`Signed in as ${username}`);

      return JSON.stringify({
        success: true,
        username,
        message: `Successfully signed in as ${username}!`,
      });
    } catch (error) {
      if ((error as any).errorMessage === 'SESSION_PASSWORD_NEEDED') {
        log.info('2FA password required');
        return JSON.stringify({
          success: false,
          requires2FA: true,
          message: '2FA password is required. Use the signIn2FA tool with your password.',
        });
      }
      log.error('Error signing in:', (error as Error).message);
      throw error;
    }
  },
};

