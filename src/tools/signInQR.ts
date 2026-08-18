import { Tool } from 'fastmcp';
import { z } from 'zod';
import { Api } from 'telegram';

import { createClient, loadTelegramSettings } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

export const SignInQRParamsSchema = z.object({});

/**
 * Sign In QR Tool — Generates a QR login token for Telegram.
 * Returns a tg:// URL that the user can scan with their Telegram app.
 * The agent should call this tool, present the URL/token to the user,
 * then call checkQRLogin to poll for completion.
 */
export const signInQRTool: Tool<undefined, typeof SignInQRParamsSchema> = {
  name: 'signInQR',
  description:
    'Step 1 of QR sign-in. Generates a login QR token URL. Present this URL to the user — they need to scan it with Telegram app (Settings > Devices > Link Desktop Device). Then call checkQRLogin to poll for acceptance.',
  parameters: SignInQRParamsSchema,
  execute: async (_args, { log }) => {
    logger.info('Generating QR login token');

    const { apiId, apiHash } = loadTelegramSettings();
    const client = await createClient(apiId, apiHash);

    try {
      const result = await client.invoke(new Api.auth.ExportLoginToken({
        apiId: parseInt(apiId, 10),
        apiHash,
        exceptIds: [],
      }));

      if (result instanceof Api.auth.LoginToken) {
        const token = Buffer.from(result.token).toString('base64url');
        const url = `tg://login?token=${token}`;
        const expiresAt = new Date(result.expires * 1000).toISOString();

        log.info('QR login token generated');

        return JSON.stringify({
          url,
          token,
          expiresAt,
          message: 'Show this URL as a QR code or link to the user. They should scan it with Telegram app (Settings > Devices > Link Desktop Device). Then call checkQRLogin to wait for acceptance.',
        });
      } else if (result instanceof Api.auth.LoginTokenSuccess) {
        log.info('Already authenticated');
        return JSON.stringify({
          success: true,
          message: 'Already authenticated! No QR scan needed.',
        });
      } else {
        return JSON.stringify({
          error: 'Unexpected response type',
          message: 'Got LoginTokenMigrateTo — call checkQRLogin to handle DC migration.',
        });
      }
    } catch (error) {
      log.error('Error generating QR token:', (error as Error).message);
      throw error;
    }
  },
};

