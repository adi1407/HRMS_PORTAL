import { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';

const THREAD_STORAGE_KEY = 'hrms_assistant_thread_id';

/** Shared chat logic for floating panel and full-page assistant (persisted threads). */
export function useAssistantChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggested, setSuggested] = useState([]);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [threadId, setThreadId] = useState(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/assistant/meta');
        if (cancelled) return;
        setSuggested(data?.data?.suggestedPrompts ?? []);
        setAiConfigured(!!data?.data?.aiConfigured);
      } catch {
        if (!cancelled) setSuggested([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THREAD_STORAGE_KEY) : null;
    if (!saved) {
      setHydrating(false);
      return;
    }

    let cancelled = false;
    setThreadId(saved);
    (async () => {
      try {
        const { data } = await api.get(`/assistant/threads/${encodeURIComponent(saved)}/messages`);
        if (cancelled) return;
        const list = data?.data?.messages;
        if (Array.isArray(list) && list.length > 0) {
          setMessages(list.map((m) => ({ role: m.role, content: m.content })));
        }
      } catch {
        try {
          localStorage.removeItem(THREAD_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        if (!cancelled) setThreadId(null);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startNewChat = useCallback(() => {
    try {
      localStorage.removeItem(THREAD_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setThreadId(null);
    setMessages([]);
    setError('');
    setInput('');
  }, []);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || loading || hydrating) return;

      setError('');
      const nextUser = { role: 'user', content: trimmed };
      const historyForApi = [...messages, nextUser].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, nextUser]);
      setInput('');
      setLoading(true);

      try {
        const body = { messages: historyForApi };
        if (threadId) body.threadId = threadId;

        const { data } = await api.post('/assistant/chat', body);
        const reply = data?.data?.message ?? '';
        const newId = data?.data?.threadId;
        if (typeof newId === 'string' && newId) {
          setThreadId(newId);
          try {
            localStorage.setItem(THREAD_STORAGE_KEY, newId);
          } catch {
            /* ignore */
          }
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: reply || 'No response.' }]);
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          'Could not reach the assistant. Check that OPENAI_API_KEY is set on the server.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, threadId, hydrating]
  );

  return {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    error,
    suggested,
    aiConfigured,
    send,
    threadId,
    hydrating,
    startNewChat,
  };
}
