import {
  listDialogsTool,
} from './listDialogs.js';
import {
  listMessagesTool
} from './listMessages.js';
import { searchDialogsTool } from './searchDialogs.js';
import { sendMessageTool } from './sendMessage.js';
import { getUnreadMessagesTool } from './getUnreadMessages.js';
import { markAsReadTool } from './markAsRead.js';
import { sendCodeTool } from './sendCode.js';
import { signInTool } from './signIn.js';
import { signIn2FATool } from './signIn2FA.js';
import { signInQRTool } from './signInQR.js';
import { checkQRLoginTool } from './checkQRLogin.js';
import { waitForMessagesTool } from './waitForMessages.js';

// New tools
import { getMeTool } from './getMe.js';
import { editMessageTool } from './editMessage.js';
import { deleteMessagesTool } from './deleteMessages.js';
import { forwardMessagesTool } from './forwardMessages.js';
import { getUserInfoTool } from './getUserInfo.js';
import { getDialogInfoTool } from './getDialogInfo.js';
import { resolveUsernameTool } from './resolveUsername.js';
import { getParticipantsTool } from './getParticipants.js';
import { sendFileTool } from './sendFile.js';
import { downloadMediaTool } from './downloadMedia.js';
import { pinMessageTool } from './pinMessage.js';
import { getPinnedMessagesTool } from './getPinnedMessages.js';
import { sendReactionTool } from './sendReaction.js';
import { searchGlobalTool } from './searchGlobal.js';
import { joinChatTool } from './joinChat.js';
import { leaveChatTool } from './leaveChat.js';
import { inviteToChatTool } from './inviteToChat.js';
import { getContactsTool } from './getContacts.js';
import { createPollTool } from './createPoll.js';
import { deleteDialogTool } from './deleteDialog.js';
import { sendMessageWithButtonsTool } from './sendMessageWithButtons.js';
import { createGroupTool } from './createGroup.js';

/**
 * Export all tools as an array
 */
export const tools = [
  // Auth tools
  sendCodeTool,
  signInTool,
  signIn2FATool,
  signInQRTool,
  checkQRLoginTool,
  // Telegram tools
  listDialogsTool,
  listMessagesTool,
  searchDialogsTool,
  sendMessageTool,
  sendMessageWithButtonsTool,
  getUnreadMessagesTool,
  markAsReadTool,
  waitForMessagesTool,
  // New tools — Priority 1
  getMeTool,
  editMessageTool,
  deleteMessagesTool,
  forwardMessagesTool,
  getUserInfoTool,
  getDialogInfoTool,
  // New tools — Priority 2
  resolveUsernameTool,
  getParticipantsTool,
  sendFileTool,
  downloadMediaTool,
  // New tools — Priority 3
  pinMessageTool,
  getPinnedMessagesTool,
  sendReactionTool,
  searchGlobalTool,
  joinChatTool,
  leaveChatTool,
  inviteToChatTool,
  getContactsTool,
  createPollTool,
  deleteDialogTool,
  createGroupTool,
];

/**
 * Export individual tools
 */
export {
  sendCodeTool,
  signInTool,
  signIn2FATool,
  signInQRTool,
  checkQRLoginTool,
  listDialogsTool,
  listMessagesTool,
  searchDialogsTool,
  sendMessageTool,
  sendMessageWithButtonsTool,
  getUnreadMessagesTool,
  markAsReadTool,
  waitForMessagesTool,
  getMeTool,
  editMessageTool,
  deleteMessagesTool,
  forwardMessagesTool,
  getUserInfoTool,
  getDialogInfoTool,
  resolveUsernameTool,
  getParticipantsTool,
  sendFileTool,
  downloadMediaTool,
  pinMessageTool,
  getPinnedMessagesTool,
  sendReactionTool,
  searchGlobalTool,
  joinChatTool,
  leaveChatTool,
  inviteToChatTool,
  getContactsTool,
  createPollTool,
  deleteDialogTool,
};
