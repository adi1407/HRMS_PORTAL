const OpenAI = require('openai');
const { ApiError } = require('../utils/api.utils');
const { getToolsForRole } = require('./assistantTools/toolDefinitions');
const { executeTool, HR_ROLES, AUDIT_ROLES } = require('./assistantTools/execute');

const MAX_TOOL_ROUNDS = 5;
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
/** Groq uses OpenAI-compatible API; keys start with gsk_ */
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

function isGroqKey(key) {
  return typeof key === 'string' && key.trim().startsWith('gsk_');
}

/**
 * Groq and OpenAI keys must not be mixed on the wrong base URL.
 * Prefer GROQ_API_KEY when using Groq; OPENAI_API_KEY may also hold a gsk_ key.
 */
function getClient() {
  const groqExplicit = process.env.GROQ_API_KEY?.trim();
  const openaiEnv = process.env.OPENAI_API_KEY?.trim();
  const key = groqExplicit || openaiEnv;
  if (!key) return null;

  if (groqExplicit || isGroqKey(openaiEnv)) {
    return new OpenAI({
      apiKey: groqExplicit || openaiEnv,
      baseURL: GROQ_BASE_URL,
    });
  }

  return new OpenAI({ apiKey });
}

function resolveModel() {
  const explicit = process.env.OPENAI_MODEL?.trim() || process.env.GROQ_MODEL?.trim();
  if (explicit) return explicit;

  const groqExplicit = process.env.GROQ_API_KEY?.trim();
  const openaiEnv = process.env.OPENAI_API_KEY?.trim();
  if (groqExplicit || isGroqKey(openaiEnv)) return DEFAULT_GROQ_MODEL;
  return DEFAULT_OPENAI_MODEL;
}

function buildSystemPrompt(user) {
  const lines = [
    'You are Adiverse HRMS Assistant — a concise, professional helper for an HR management system.',
    'You MUST answer only using facts returned by the tools. If a tool returns an error or access denied, explain that politely.',
    'Never invent employee counts, leave statuses, or attendance data.',
    'Use short paragraphs or bullet points when listing data.',
    `Current user: ${user.name} (${user.employeeId || '—'}), role: ${user.role}.`,
    'Employees may only see their own data via my_* tools.',
  ];
  if (HR_ROLES.has(user.role)) {
    lines.push('HR/Director/Accounts/Super Admin may use hr_* tools for organization metrics (no PII beyond what the tool returns).');
  }
  if (AUDIT_ROLES.has(user.role)) {
    lines.push('Director and Super Admin may use admin_audit_recent_summary for audit log counts.');
  }
  if (user.role === 'ACCOUNTS') {
    lines.push('Accounts may use accounts_salary_month_status for slip counts by status only (no amounts).');
  }
  return lines.join('\n');
}

/**
 * @param {import('mongoose').Document} user - req.user
 * @param {{ role: string; content: string }[]} messages - last turns from client (no system)
 */
async function runAssistantChat(user, messages) {
  const client = getClient();
  if (!client) {
    throw new ApiError(
      503,
      'AI assistant is not configured. Set OPENAI_API_KEY (OpenAI, sk-…) or GROQ_API_KEY / OPENAI_API_KEY with a Groq key (gsk_…) on the server.'
    );
  }

  const model = resolveModel();
  const tools = getToolsForRole(user.role);

  const openaiMessages = [
    { role: 'system', content: buildSystemPrompt(user) },
    ...messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  if (openaiMessages.length < 2) {
    throw new ApiError(400, 'Send at least one user message.');
  }

  let rounds = 0;
  /** @type {string[]} */
  const toolsUsed = [];
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const completion = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? 'auto' : undefined,
      temperature: 0.3,
      max_tokens: 2048,
    });

    const choice = completion.choices[0];
    if (!choice?.message) {
      throw new ApiError(502, 'Empty response from AI.');
    }

    const msg = choice.message;
    const toolCalls = msg.tool_calls;

    if (!toolCalls?.length) {
      const text = msg.content || '';
      return {
        message: text,
        role: 'assistant',
        model: completion.model,
        usage: completion.usage,
        toolsUsed: [...new Set(toolsUsed)],
      };
    }

    openaiMessages.push({
      role: 'assistant',
      content: msg.content || null,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args = {};
      try {
        args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }
      if (name) toolsUsed.push(name);
      const result = await executeTool(user, name, args);
      openaiMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new ApiError(400, 'Too many tool rounds. Try a simpler question.');
}

module.exports = { runAssistantChat, getClient };
