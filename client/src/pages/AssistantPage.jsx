import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/assistant.css';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useAssistantChat } from '../components/assistant/useAssistantChat';
import AssistantChatContent from '../components/assistant/AssistantChatContent';

export default function AssistantPage() {
  const navigate = useNavigate();
  const chat = useAssistantChat();

  return (
    <div className="assistant-page">
      <header className="assistant-page__top">
        <button type="button" className="assistant-page__back" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <div className="assistant-page__title">
          <Sparkles size={20} />
          <span>HRMS Assistant</span>
        </div>
      </header>
      <div className="assistant-page__body">
        <AssistantChatContent {...chat} variant="page" />
      </div>
    </div>
  );
}
