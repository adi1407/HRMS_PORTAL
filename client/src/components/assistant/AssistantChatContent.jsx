import React from 'react';

/**
 * Shared markup for assistant messages + input (used by floating panel and full page).
 */
export default function AssistantChatContent({
  messages,
  input,
  setInput,
  loading,
  error,
  suggested,
  aiConfigured,
  send,
  variant = 'panel',
  hydrating = false,
  threadId = null,
  startNewChat,
}) {
  const isPage = variant === 'page';
  const showNewChat = typeof startNewChat === 'function' && !hydrating && (messages.length > 0 || threadId);

  return (
    <>
      {!aiConfigured && (
        <div className="assistant-panel__banner">
          Server missing <code>OPENAI_API_KEY</code> — configure it on Render for AI answers.
        </div>
      )}

      {hydrating && (
        <div className="assistant-panel__banner assistant-panel__banner--muted">Loading saved conversation…</div>
      )}

      {showNewChat && (
        <div className={isPage ? 'assistant-page__toolbar' : 'assistant-panel__toolbar'}>
          <button type="button" className="assistant-new-chat" onClick={startNewChat}>
            New conversation
          </button>
        </div>
      )}

      {suggested.length > 0 && messages.length === 0 && (
        <div className={isPage ? 'assistant-page__suggestions' : 'assistant-panel__suggestions'}>
          {suggested.map((s) => (
            <button key={s} type="button" className="assistant-chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className={isPage ? 'assistant-page__messages' : 'assistant-messages'}>
        {messages.length === 0 && (
          <div className="assistant-msg assistant-msg--assistant">
            Ask about your leave, attendance, daily tasks, or profile completion. HR users can ask for team
            attendance and leave overviews.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`assistant-msg ${m.role === 'user' ? 'assistant-msg--user' : 'assistant-msg--assistant'}`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="assistant-msg assistant-msg--assistant" style={{ opacity: 0.8 }}>
            Thinking…
          </div>
        )}
      </div>

      {error && <div className="assistant-error">{error}</div>}

      <div className={isPage ? 'assistant-page__input-row' : 'assistant-input-row'}>
        <textarea
          className="assistant-input"
          rows={isPage ? 3 : 2}
          placeholder="Ask the assistant…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          disabled={loading || hydrating}
        />
        <button
          type="button"
          className="assistant-send"
          disabled={loading || hydrating || !input.trim()}
          onClick={() => send(input)}
        >
          Send
        </button>
      </div>
    </>
  );
}
