const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth.middleware');
const { runAssistantChat } = require('../services/assistant.service');
const { createAuditLog } = require('../utils/auditLog.utils');
const { ApiError } = require('../utils/api.utils');

const router = express.Router();

const { HR_ROLES } = require('../services/assistantTools/execute');

function suggestedPromptsForRole(role) {
  const common = [
    'Summarize my leave status for this month.',
    'What is my profile completion percentage?',
    'Show my recent attendance summary.',
  ];
  if (HR_ROLES.has(role)) {
    return [
      'How many employees are present today vs absent?',
      'Give me an overview of leave requests this month.',
      'What does today\'s attendance dashboard show?',
      ...common,
    ];
  }
  return common;
}

const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many assistant requests. Please try again in a few minutes.' },
});

/**
 * POST /api/assistant/chat
 * Body: { messages: { role: 'user'|'assistant', content: string }[] }
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
    if (!Array.isArray(messages)) {
      return next(new ApiError(400, 'Request body must include a messages array.'));
    }

    const result = await runAssistantChat(req.user, messages);

    await createAuditLog({
      actor: req.user,
      action: 'ASSISTANT_CHAT',
      method: 'POST',
      description: 'HRMS AI assistant completion',
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
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
