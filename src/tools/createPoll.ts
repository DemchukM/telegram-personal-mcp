import { Tool } from 'fastmcp';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { z } from 'zod';

import { createClient } from '../lib/telegram.js';
import { logger } from '../utils/logger.js';

/**
 * Schema for CreatePoll parameters
 */
export const CreatePollParamsSchema = z.object({
  dialogId: z.string().describe('ID of the dialog to send the poll to'),
  question: z.string().min(1).max(300).describe('Poll question (max 300 characters)'),
  answers: z.array(z.string().min(1).max(100)).min(2).max(10).describe('Array of answer options (2-10 options, each max 100 characters)'),
  anonymous: z.boolean().optional().default(true).describe('Whether the poll is anonymous (default: true)'),
  multipleChoice: z.boolean().optional().default(false).describe('Allow multiple answers (default: false)'),
  quiz: z.boolean().optional().default(false).describe('Whether this is a quiz with one correct answer (default: false)'),
  correctAnswer: z.number().optional().describe('Index of the correct answer (0-based, required if quiz=true)'),
  explanation: z.string().optional().describe('Explanation shown after answering (only for quizzes)'),
});

/**
 * Create Poll Tool - Send a poll to a dialog
 */
export const createPollTool: Tool<undefined, typeof CreatePollParamsSchema> = {
  name: "createPoll",
  description: "Send a poll or quiz to a Telegram dialog. Supports anonymous/public polls, multiple choice, and quiz mode with correct answer.",
  parameters: CreatePollParamsSchema,
  execute: async (args, { log }) => {
    logger.info("Creating poll", { dialogId: args.dialogId, question: args.question });

    const validArgs = CreatePollParamsSchema.parse(args);
    const client = await createClient();

    try {
      const peer = await client.getInputEntity(bigInt(validArgs.dialogId));

      const pollAnswers = validArgs.answers.map((text, i) =>
        new Api.PollAnswer({
          text: new Api.TextWithEntities({ text, entities: [] }),
          option: Buffer.from([i]),
        })
      );

      const poll = new Api.Poll({
        id: bigInt(Date.now()),
        question: new Api.TextWithEntities({ text: validArgs.question, entities: [] }),
        answers: pollAnswers,
        publicVoters: !validArgs.anonymous,
        multipleChoice: validArgs.multipleChoice,
        quiz: validArgs.quiz,
      });

      const mediaOptions: any = {
        poll,
      };

      if (validArgs.quiz && validArgs.correctAnswer !== undefined) {
        mediaOptions.correctAnswers = [Buffer.from([validArgs.correctAnswer])];
        if (validArgs.explanation) {
          mediaOptions.solution = validArgs.explanation;
          mediaOptions.solutionEntities = [];
        }
      }

      const media = new Api.InputMediaPoll(mediaOptions);

      const result = await client.invoke(
        new Api.messages.SendMedia({
          peer,
          media,
          message: '',
          randomId: bigInt(Math.floor(Math.random() * 1e15)),
        })
      );

      const updates = result as any;
      const msgId = updates.updates?.find((u: any) => u.className === 'UpdateMessageID')?.id
        || updates.id
        || null;

      log.debug(`Poll created, id=${msgId}`);

      return JSON.stringify({
        success: true,
        dialogId: validArgs.dialogId,
        messageId: msgId,
        question: validArgs.question,
        answersCount: validArgs.answers.length,
      });
    } catch (error) {
      log.error('Error creating poll:', (error as Error).message);
      throw error;
    }
  }
};

