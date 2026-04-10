import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Button schema
 */
const ButtonSchema = z.object({
  text: z.string().describe('Button label text'),
  type: z.enum(['callback', 'url', 'switch_inline']).optional().default('callback')
    .describe('Button type: "callback" (data button), "url" (opens URL), "switch_inline" (inline query)'),
  data: z.string().optional().describe('Callback data for "callback" buttons (max 64 bytes). Defaults to the button text.'),
  url: z.string().optional().describe('URL for "url" buttons'),
  query: z.string().optional().describe('Inline query for "switch_inline" buttons'),
});

/**
 * Schema for SendMessageWithButtons parameters
 */
export const SendMessageWithButtonsParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog (user, chat or channel) to send the message to'),
  message: z.string().min(1).describe('Text content of the message to send'),
  buttons: z.array(z.array(ButtonSchema).min(1)).min(1)
    .describe('2D array of buttons (rows × columns). Each inner array is a row of buttons. Max 100 buttons total, max 8 per row.'),
  inline: z.boolean().optional().default(true)
    .describe('Whether to use inline keyboard (true, default) or reply keyboard (false). Inline keyboards appear under the message; reply keyboards replace the user\'s keyboard.'),
  replyToMessageId: z.number().optional().describe('ID of the message to reply to (optional)'),
});

/**
 * Convert button config to API button object
 */
function toApiButton(btn: z.infer<typeof ButtonSchema>): Api.TypeKeyboardButton {
  switch (btn.type) {
    case 'url':
      return new Api.KeyboardButtonUrl({
        text: btn.text,
        url: btn.url || '',
      });
    case 'switch_inline':
      return new Api.KeyboardButtonSwitchInline({
        text: btn.text,
        query: btn.query || '',
      });
    case 'callback':
    default:
      return new Api.KeyboardButtonCallback({
        text: btn.text,
        data: Buffer.from(btn.data || btn.text),
      });
  }
}

/**
 * Send Message With Buttons Tool - Send a message with inline or reply keyboard
 */
export const sendMessageWithButtonsTool: Tool<undefined, typeof SendMessageWithButtonsParamsSchema> = {
  name: "sendMessageWithButtons",
  description: "Send a text message with inline keyboard buttons or reply keyboard. ⚠️ This only works when signed in as a Telegram BOT (not a user account). Supports callback buttons, URL buttons, and switch-inline buttons.",
  parameters: SendMessageWithButtonsParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Sending message with buttons", { dialogId: args.dialogId });

    const validArgs = SendMessageWithButtonsParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      const rows = validArgs.buttons.map(row =>
        new Api.KeyboardButtonRow({
          buttons: row.map(toApiButton),
        })
      );

      const replyMarkup = validArgs.inline
        ? new Api.ReplyInlineMarkup({ rows })
        : new Api.ReplyKeyboardMarkup({
            rows,
            resize: true,
            singleUse: false,
            selective: false,
          });

      const result = await client.invoke(
        new Api.messages.SendMessage({
          peer,
          message: validArgs.message,
          randomId: bigInt(Math.floor(Math.random() * 1e15)),
          replyMarkup,
          replyTo: validArgs.replyToMessageId
            ? new Api.InputReplyToMessage({ replyToMsgId: validArgs.replyToMessageId })
            : undefined,
        })
      );

      const updates = result as any;
      const msgId = updates.updates?.find((u: any) => u.className === 'UpdateMessageID')?.id
        || updates.id
        || null;

      log.debug(`Message with buttons sent, id=${msgId}`);

      return JSON.stringify({
        id: msgId,
        message: validArgs.message,
        buttonsCount: validArgs.buttons.flat().length,
      });
    } catch (error) {
      log.error('Error sending message with buttons:', (error as Error).message);
      throw error;
    }
  }
};

