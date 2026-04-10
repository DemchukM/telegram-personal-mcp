import { Tool } from 'fastmcp';
import { z } from 'zod';

import { createClient, loadTelegramSettings } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

export const SendCodeParamsSchema = z.object({
  phoneNumber: z.string().min(1).describe('Phone number with country code, e.g. "+380991234567"'),
});

/**
 * Send Code Tool — Step 1 of Telegram sign-in.
 * Sends an auth code to the phone number and returns phoneCodeHash needed for the next step.
 */
export const sendCodeTool: Tool<undefined, typeof SendCodeParamsSchema> = {
  name: 'sendCode',
  description:
    'Step 1 of Telegram sign-in. Sends an authentication code to the given phone number. Returns phoneCodeHash — pass it to signIn together with the code you receive.',
  parameters: SendCodeParamsSchema,
  execute: async (args, { log }) => {
    logger.info('Sending auth code', { phoneNumber: args.phoneNumber });

    const { apiId, apiHash } = loadTelegramSettings();
    const client = await createClient(apiId, apiHash);

    try {
      const result = await client.sendCode(
        {
          apiId: parseInt(apiId, 10),
          apiHash,
        },
        args.phoneNumber,
      );

      log.info('Auth code sent successfully');

      return JSON.stringify({
        phoneCodeHash: result.phoneCodeHash,
        phoneNumber: args.phoneNumber,
        message: 'Auth code sent. Use signIn tool with the code, phoneNumber, and phoneCodeHash.',
      });
    } catch (error) {
      log.error('Error sending auth code:', (error as Error).message);
      throw error;
    }
  },
};

