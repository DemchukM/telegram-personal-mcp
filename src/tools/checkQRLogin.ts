import { Tool } from 'fastmcp';
import { z } from 'zod';
import { Api } from 'telegram';

import { createClient, loadTelegramSettings } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

export const CheckQRLoginParamsSchema = z.object({
  timeout: z.number().min(1).max(60).default(30).describe('How many seconds to poll for QR acceptance (1-60, default 30)'),
});

/**
 * Check QR Login Tool — Polls for QR login acceptance.
 * Call after signInQR to wait for the user to scan the QR code.
 */
export const checkQRLoginTool: Tool<undefined, typeof CheckQRLoginParamsSchema> = {
  name: 'checkQRLogin',
  description:
    'Step 2 of QR sign-in. Polls Telegram to check if the user scanned the QR code. Call after signInQR. If 2FA is needed, returns SESSION_PASSWORD_NEEDED — then use signIn2FA tool.',
  parameters: CheckQRLoginParamsSchema,
  execute: async (args, { log }) => {
    logger.info('Polling for QR login acceptance');

    const { apiId, apiHash } = loadTelegramSettings();
    const client = await createClient(apiId, apiHash);
    const apiIdNum = parseInt(apiId, 10);

    const deadline = Date.now() + (args.timeout ?? 30) * 1000;

    try {
      while (Date.now() < deadline) {
        try {
          const result = await client.invoke(new Api.auth.ExportLoginToken({
            apiId: apiIdNum,
            apiHash,
            exceptIds: [],
          }));

          if (result instanceof Api.auth.LoginTokenSuccess) {
            log.info('QR login successful');
            const user = await client.getMe();
            return JSON.stringify({
              success: true,
              user: user ? { id: user.id?.toString(), username: user.username, firstName: user.firstName } : null,
              message: 'Successfully signed in via QR code!',
            });
          } else if (result instanceof Api.auth.LoginTokenMigrateTo) {
            // @ts-ignore - _switchDC is internal but needed
            await client._switchDC(result.dcId);
            const migratedResult = await client.invoke(new Api.auth.ImportLoginToken({
              token: result.token,
            }));
            if (migratedResult instanceof Api.auth.LoginTokenSuccess) {
              log.info('QR login successful (after DC migration)');
              const user = await client.getMe();
              return JSON.stringify({
                success: true,
                user: user ? { id: user.id?.toString(), username: user.username, firstName: user.firstName } : null,
                message: 'Successfully signed in via QR code!',
              });
            }
          }
          // Still LoginToken — not yet scanned, wait and retry
        } catch (error: any) {
          if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            log.info('2FA password required');
            return JSON.stringify({
              success: false,
              needsPassword: true,
              message: 'QR code accepted but 2FA password is required. Use signIn2FA tool with your password.',
            });
          } else if (error.errorMessage === 'TOKEN_EXPIRED') {
            log.info('Token expired');
            return JSON.stringify({
              success: false,
              expired: true,
              message: 'QR token expired. Call signInQR again to generate a new one.',
            });
          }
          throw error;
        }

        await new Promise(r => setTimeout(r, 2000));
      }

      // Timeout reached
      log.info('QR login poll timeout');
      return JSON.stringify({
        success: false,
        timeout: true,
        message: 'Timeout waiting for QR scan. Call checkQRLogin again to continue waiting, or signInQR to get a fresh token.',
      });
    } catch (error) {
      log.error('Error checking QR login:', (error as Error).message);
      throw error;
    }
  },
};

