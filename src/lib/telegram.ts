import { Api, TelegramClient } from 'telegram';
import { StoreSession } from 'telegram/sessions/index.js';
import { computeCheck } from 'telegram/Password.js'
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';
// @ts-ignore - no type declarations available
import qrcode from 'qrcode-terminal';

import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Resolve session directory relative to the project root (two levels up from src/lib/)
// This avoids issues when CWD is a system directory like C:\WINDOWS\system32
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export interface TelegramSettings {
  apiId: string;
  apiHash: string;
}

/**
 * Load Telegram settings from config
 */
export function loadTelegramSettings(): TelegramSettings {
  const apiId = config.telegram.apiId;
  const apiHash = config.telegram.apiHash;

  if (!apiId || !apiHash) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables must be set');
  }

  return { apiId, apiHash };
}

/**
 * Connect to Telegram using the provided credentials
 */
export async function connectToTelegram(apiId: string, apiHash: string, phoneNumber: string): Promise<void> {
  const client = await createClient(apiId, apiHash);

  logger.info('Sending authentication code...');
  const result = await client.sendCode({
    apiId: parseInt(apiId, 10),
    apiHash,
  }, phoneNumber);
  logger.info('Code sent! Check your Telegram app or SMS.');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const phoneCode = await new Promise<string>((resolve) => {
    rl.question('Enter login code: ', (answer) => {
      resolve(answer);
      rl.close();
    });
  });

  try {
    await client.invoke(new Api.auth.SignIn({
      phoneNumber,
      phoneCodeHash: result.phoneCodeHash,
      phoneCode
    }));
  } catch (error) {
    if ((error as any).errorMessage === 'SESSION_PASSWORD_NEEDED') {
      const passSrpRes = await client.invoke(new Api.account.GetPassword());

      const password = await new Promise<string>((resolve) => {
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('Enter 2FA password: ', (answer) => {
          resolve(answer);
          rl.close();
        });
      });

      const passSrpCheck = await computeCheck(passSrpRes, password)
      await client.invoke(new Api.auth.CheckPassword({
        password: passSrpCheck
      }));
    } else {
      throw error;
    }
  }

  const user = await client.getMe();
  if (user && user.username) {
    logger.info(`Hey ${user.username}! You are connected!`);
  } else {
    logger.info('Connected!');
  }
  logger.info('You can now use the mcp-telegram server.');
}

/**
 * Connect to Telegram via QR code scan
 */
export async function connectToTelegramQR(apiId: string, apiHash: string): Promise<void> {
  const client = await createClient(apiId, apiHash);

  const apiIdNum = parseInt(apiId, 10);

  let resolved = false;

  while (!resolved) {
    const result = await client.invoke(new Api.auth.ExportLoginToken({
      apiId: apiIdNum,
      apiHash,
      exceptIds: [],
    }));

    if (result instanceof Api.auth.LoginToken) {
      const token = Buffer.from(result.token).toString('base64url');
      const url = `tg://login?token=${token}`;

      logger.info('Scan this QR code with your Telegram app:');
      logger.info('(Telegram > Settings > Devices > Link Desktop Device)\n');
      qrcode.generate(url, { small: true }, (code: string) => {
        console.error(code);
      });

      // Wait for the token to be accepted (poll every 2s, timeout after expires)
      const expiresIn = result.expires - Math.floor(Date.now() / 1000);
      const deadline = Date.now() + expiresIn * 1000;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const pollResult = await client.invoke(new Api.auth.ExportLoginToken({
            apiId: apiIdNum,
            apiHash,
            exceptIds: [],
          }));

          if (pollResult instanceof Api.auth.LoginTokenSuccess) {
            resolved = true;
            break;
          } else if (pollResult instanceof Api.auth.LoginTokenMigrateTo) {
            // Need to reconnect to another DC
            await client._switchDC(pollResult.dcId);
            const migratedResult = await client.invoke(new Api.auth.ImportLoginToken({
              token: pollResult.token,
            }));
            if (migratedResult instanceof Api.auth.LoginTokenSuccess) {
              resolved = true;
              break;
            }
          }
        } catch (error: any) {
          if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            // 2FA required
            const passSrpRes = await client.invoke(new Api.account.GetPassword());
            const rl = createInterface({ input: process.stdin, output: process.stdout });
            const password = await new Promise<string>((resolve) => {
              rl.question('Enter 2FA password: ', (answer) => {
                resolve(answer);
                rl.close();
              });
            });
            const passSrpCheck = await computeCheck(passSrpRes, password);
            await client.invoke(new Api.auth.CheckPassword({ password: passSrpCheck }));
            resolved = true;
            break;
          } else if (error.errorMessage === 'TOKEN_EXPIRED') {
            logger.info('QR token expired, generating new one...');
            break; // Break inner loop, outer loop will generate new token
          } else {
            throw error;
          }
        }
      }
    } else if (result instanceof Api.auth.LoginTokenSuccess) {
      resolved = true;
    } else if (result instanceof Api.auth.LoginTokenMigrateTo) {
      await client._switchDC(result.dcId);
      const migratedResult = await client.invoke(new Api.auth.ImportLoginToken({
        token: result.token,
      }));
      if (migratedResult instanceof Api.auth.LoginTokenSuccess) {
        resolved = true;
      }
    }
  }

  const user = await client.getMe();
  if (user && user.username) {
    logger.info(`Hey ${user.username}! You are connected!`);
  } else {
    logger.info('Connected!');
  }
  logger.info('You can now use the mcp-telegram server.');
}

/**
 * Logout from Telegram
 */
export async function logoutFromTelegram(): Promise<void> {
  const client = await createClient();
  await client.invoke(new Api.auth.LogOut());
  logger.info('You are now logged out from Telegram.');
}

// Cache for the client
let cachedClient: TelegramClient | null = null;

/**
 * Create a Telegram client
 */
export async function createClient(
  apiId?: string,
  apiHash?: string,
  sessionName = 'mcp_telegram_session'
): Promise<TelegramClient> {
  if (cachedClient) return cachedClient;

  let telegramConfig: TelegramSettings;
  if (apiId && apiHash) {
    telegramConfig = { apiId, apiHash };
  } else {
    telegramConfig = loadTelegramSettings();
  }

  // StoreSession uses "./" + name internally (node-localstorage), so it's always
  // relative to cwd. Change cwd to project root to ensure the session folder is
  // created there, not in system directories like C:\WINDOWS\system32.
  process.chdir(PROJECT_ROOT);
  const session = new StoreSession(sessionName);
  cachedClient = new TelegramClient(
    session,
    parseInt(telegramConfig.apiId, 10),
    telegramConfig.apiHash,
    {
      connectionRetries: 5,
      // baseLogger: logger
    }
  );
  await cachedClient.connect();

  return cachedClient;
}