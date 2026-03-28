import { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';

/** Shared chat logic for floating panel and full-page assistant */
export function useAssistantChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggested, setSuggested] = useState([]);
  const [aiConfigured, setAiConfigured] = useState(true);

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

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

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
        const { data } = await api.post('/assistant/chat', { messages: historyForApi });
        const reply = data?.data?.message ?? '';
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
    [loading, messages]
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
  };
}
