const mongoose = require('mongoose');
const AssistantChatThread = require('../models/AssistantChatThread.model');
const AssistantChatMessage = require('../models/AssistantChatMessage.model');

const MAX_STORED_MESSAGES = 80;
const MAX_TITLE_LEN = 100;

/** Sequential persist (no multi-doc transaction) so standalone MongoDB works without replica set. */

function deriveTitleFromMessages(messages) {
  const firstUser = messages.find((m) => m && m.role === 'user' && typeof m.content === 'string');
  if (!firstUser) return 'Conversation';
  const t = firstUser.content.trim().replace(/\s+/g, ' ');
  return t.length <= MAX_TITLE_LEN ? t : `${t.slice(0, MAX_TITLE_LEN)}…`;
}

/**
 * @param {string} threadId
 * @param {import('mongoose').Types.ObjectId} userId
 */
async function getThreadForUser(threadId, userId) {
  if (!mongoose.Types.ObjectId.isValid(threadId)) return null;
  return AssistantChatThread.findOne({ _id: threadId, user: userId }).lean();
}

/**
 * @param {{ role: string; content: string }[]} transcript
 */
async function persistTranscript(threadId, transcript) {
  const slice = transcript.slice(-MAX_STORED_MESSAGES);
  await AssistantChatMessage.deleteMany({ thread: threadId });
  if (slice.length > 0) {
    const docs = slice.map((m, i) => ({
      thread: threadId,
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 64000),
      order: i,
    }));
    await AssistantChatMessage.insertMany(docs, { ordered: true });
  }
  await AssistantChatThread.updateOne({ _id: threadId }, { $set: { updatedAt: new Date() } });
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {{ role: string; content: string }[]} transcript
 */
async function createThreadAndPersist(userId, transcript) {
  const title = deriveTitleFromMessages(transcript);
  const thread = await AssistantChatThread.create({ user: userId, title });
  await persistTranscript(thread._id, transcript);
  return thread;
}

/**
 * @param {string} threadId
 */
async function listMessages(threadId) {
  const rows = await AssistantChatMessage.find({ thread: threadId }).sort({ order: 1 }).select('role content').lean();
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
async function listThreadsForUser(userId, limit = 40) {
  return AssistantChatThread.find({ user: userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('title createdAt updatedAt')
    .lean();
}

/**
 * @param {string} threadId
 * @param {import('mongoose').Types.ObjectId} userId
 */
async function deleteThreadIfOwned(threadId, userId) {
  if (!mongoose.Types.ObjectId.isValid(threadId)) return { deleted: false };
  const thread = await AssistantChatThread.findOne({ _id: threadId, user: userId });
  if (!thread) return { deleted: false };
  await AssistantChatMessage.deleteMany({ thread: thread._id });
  await AssistantChatThread.deleteOne({ _id: thread._id });
  return { deleted: true };
}

module.exports = {
  deriveTitleFromMessages,
  getThreadForUser,
  persistTranscript,
  createThreadAndPersist,
  listMessages,
  listThreadsForUser,
  deleteThreadIfOwned,
  MAX_STORED_MESSAGES,
};
