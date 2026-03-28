const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth.middleware');
const { runAssistantChat } = require('../services/assistant.service');
const {
  getThreadForUser,
  persistTranscript,
  createThreadAndPersist,
  listMessages,
  listThreadsForUser,
  deleteThreadIfOwned,
} = require('../services/assistantThread.service');
const { createAuditLog } = require('../utils/auditLog.utils');
const { ApiError } = require('../utils/api.utils');

const router = express.Router();

const { HR_ROLES, AUDIT_ROLES } = require('../services/assistantTools/execute');

function suggestedPromptsForRole(role) {
  const selfService = [
    'Summarize my leave status for this month.',
    'What is my profile completion percentage?',
    'Show my recent attendance summary.',
    'How are my expense claims looking by status?',
    'Do I have open help desk tickets?',
    'What is my onboarding checklist progress?',
    'How many unread notifications do I have?',
  ];

  const hrOps = [
    'How many employees are present today vs absent?',
    'Give me an overview of leave requests this month.',
    'What does today\'s attendance dashboard show?',
    'List pending leave requests (sample).',
    'Summarize recruitment: job openings and applications by status.',
    'How is the organization doing on daily task submissions this month?',
  ];

  if (role === 'EMPLOYEE') return selfService;

  if (role === 'ACCOUNTS') {
    return [
      'For this payroll month, how many salary slips are draft vs final?',
      ...hrOps,
      ...selfService,
    ];
  }

  if (AUDIT_ROLES.has(role)) {
    return [
      'Summarize audit log activity in the last 24 hours and 7 days by action.',
      ...hrOps,
      ...selfService,
    ];
  }

  if (HR_ROLES.has(role)) {
    return [...hrOps, ...selfService];
  }

  return selfService;
}

const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many assistant requests. Please try again in a few minutes.' },
});

/**
 * GET /api/assistant/threads — list recent conversations for the logged-in user.
 */
router.get('/threads', authenticate, async (req, res, next) => {
  try {
    const rows = await listThreadsForUser(req.user._id, 40);
    res.json({
      success: true,
      data: {
        threads: rows.map((t) => ({
          id: t._id,
          title: t.title,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/assistant/threads/:threadId/messages — load persisted messages (owner only).
 */
router.get('/threads/:threadId/messages', authenticate, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const thread = await getThreadForUser(threadId, req.user._id);
    if (!thread) {
      return next(new ApiError(404, 'Conversation not found.'));
    }
    const messages = await listMessages(threadId);
    res.json({ success: true, data: { threadId, messages } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/assistant/threads/:threadId — remove a conversation (owner only).
 */
router.delete('/threads/:threadId', authenticate, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { deleted } = await deleteThreadIfOwned(threadId, req.user._id);
    if (!deleted) {
      return next(new ApiError(404, 'Conversation not found.'));
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/assistant/meta — suggested prompts and whether AI keys are configured.
 */
router.get('/meta', authenticate, (req, res) => {
  const hasOpenAi = !!process.env.OPENAI_API_KEY?.trim();
  const hasGroq = !!process.env.GROQ_API_KEY?.trim();
  res.json({
    success: true,
    data: {
      suggestedPrompts: suggestedPromptsForRole(req.user.role),
      aiConfigured: hasOpenAi || hasGroq,
    },
  });
});

router.post('/chat', assistantLimiter, authenticate, async (req, res, next) => {
  try {
    const { messages } = req.body;
    const rawThreadId = typeof req.body.threadId === 'string' ? req.body.threadId.trim() : '';

    if (!Array.isArray(messages)) {
      return next(new ApiError(400, 'Request body must include a messages array.'));
    }

    if (rawThreadId) {
      const owned = await getThreadForUser(rawThreadId, req.user._id);
      if (!owned) {
        return next(new ApiError(404, 'Conversation not found.'));
      }
    }

    const result = await runAssistantChat(req.user, messages);

    const transcript = [
      ...messages.filter(
        (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      ),
      { role: 'assistant', content: result.message || '' },
    ];

    let threadIdOut;
    if (rawThreadId) {
      await persistTranscript(rawThreadId, transcript);
      threadIdOut = rawThreadId;
    } else {
      const thread = await createThreadAndPersist(req.user._id, transcript);
      threadIdOut = String(thread._id);
    }

    const toolSummary =
      Array.isArray(result.toolsUsed) && result.toolsUsed.length
        ? result.toolsUsed.join(', ')
        : 'none';
    await createAuditLog({
      actor: req.user,
      action: 'ASSISTANT_CHAT',
      method: 'POST',
      description: `HRMS AI assistant completion; tools: ${toolSummary}`,
      req,
      statusCode: 200,
      path: req.originalUrl,
    });

    res.json({
      success: true,
      data: {
        message: result.message,
        role: result.role,
        model: result.model,
        usage: result.usage,
        toolsUsed: result.toolsUsed || [],
        threadId: threadIdOut,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
