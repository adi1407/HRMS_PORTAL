import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/assistant.css';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { useAssistantChat } from './useAssistantChat';
import AssistantChatContent from './AssistantChatContent';

/**
 * Floating HRMS AI assistant — portaled to document.body so flex layout cannot hide it.
 * Full-page chat lives at /assistant (see AssistantPage).
 * @param {{ showFab?: boolean }} props — hide floating button on /assistant (full-page mode).
 */
export default function AssistantPanel({ showFab = true }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const chat = useAssistantChat();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !showFab) return null;

  const node = (
    <div className="assistant-portal-root" aria-live="polite">
      <button
        type="button"
        className="assistant-fab"
        aria-label="Open HRMS assistant"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>

      {open && (
        <div className="assistant-panel" role="dialog" aria-label="HRMS AI assistant">
          <div className="assistant-panel__header">
            <div className="assistant-panel__title">
              <Sparkles size={18} />
              HRMS Assistant
            </div>
            <button type="button" className="assistant-panel__close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <AssistantChatContent {...chat} variant="panel" />
        </div>
      )}
    </div>
  );

  return createPortal(node, document.body);
}
