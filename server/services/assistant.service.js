const OpenAI = require('openai');
const { ApiError } = require('../utils/api.utils');
const { getToolsForRole } = require('./assistantTools/toolDefinitions');
const { executeTool } = require('./assistantTools/execute');

const MAX_TOOL_ROUNDS = 5;
const DEFAULT_MODEL = 'gpt-4o-mini';

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function buildSystemPrompt(user) {
  return [
    'You are Adiverse HRMS Assistant — a concise, professional helper for an HR management system.',
    'You MUST answer only using facts returned by the tools. If a tool returns an error or access denied, explain that politely.',
    'Never invent employee counts, leave statuses, or attendance data.',
    'Use short paragraphs or bullet points when listing data.',
    `Current user: ${user.name} (${user.employeeId || '—'}), role: ${user.role}.`,
    'Employees may only see their own data via my_* tools. HR/Director/Accounts/Super Admin may use hr_* tools for organization metrics.',
  ].join('\n');
}

/**
 * @param {import('mongoose').Document} user - req.user
 * @param {{ role: string; content: string }[]} messages - last turns from client (no system)
 */
async function runAssistantChat(user, messages) {
  const client = getClient();
  if (!client) {
    throw new ApiError(503, 'AI assistant is not configured. Set OPENAI_API_KEY on the server.');
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
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
