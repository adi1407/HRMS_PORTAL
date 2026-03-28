/** Shared assistant API contract (web + mobile). */
export type AssistantChatRole = 'user' | 'assistant';

export type AssistantChatMessage = {
  role: AssistantChatRole;
  content: string;
};

export type AssistantChatResponse = {
  message: string;
  role: string;
  model?: string;
  usage?: unknown;
  /** Persisted conversation id (returned on every successful chat). */
  threadId?: string;
};
