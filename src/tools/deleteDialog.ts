import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for DeleteDialog parameters
 */
export const DeleteDialogParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog to delete or clear'),
  justClear: z.boolean().optional().default(true).describe('If true, only clears history but keeps the dialog. If false, deletes the dialog entirely. (default: true)'),
  revoke: z.boolean().optional().default(false).describe('Also delete for the other participant in private chats (default: false)'),
});

/**
 * Delete Dialog Tool - Delete or clear a dialog's history
 */
export const deleteDialogTool: Tool<undefined, typeof DeleteDialogParamsSchema> = {
  name: "deleteDialog",
  description: "Delete or clear the history of a Telegram dialog. By default clears history without removing the dialog.",
  parameters: DeleteDialogParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Deleting dialog", { dialogId: args.dialogId, justClear: args.justClear });

    const validArgs = DeleteDialogParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      await client.invoke(
        new Api.messages.DeleteHistory({
          peer,
          maxId: 0, // 0 = all messages
          justClear: validArgs.justClear,
          revoke: validArgs.revoke,
        })
      );

      const action = validArgs.justClear ? 'cleared' : 'deleted';
      log.debug(`Dialog ${validArgs.dialogId} ${action}`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
        action,
      });
    } catch (error) {
      log.error('Error deleting dialog:', (error as Error).message);
      throw error;
    }
  }
};

