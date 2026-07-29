// src/pages/SocraticTutorPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WSTutorService } from '../services/wsTutorService';
import type { ChatMessage } from '../types/aios';
import { Send, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

export const SocraticTutorPage: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I am your SafeScholar Socratic Tutor. I'm here to guide you to the answers yourself. What concept or problem are we exploring today?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WSTutorService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleIncomingToken = useCallback((chunk: string) => {
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.sender === 'ai' && lastMsg.isStreaming) {
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, text: lastMsg.text + chunk }
        ];
      } else {
        return [
          ...prev,
          {
            id: Date.now().toString(),
            sender: 'ai',
            text: chunk,
            timestamp: new Date(),
            isStreaming: true
          }
        ];
      }
    });
  }, []);

  useEffect(() => {
    wsRef.current = new WSTutorService(
      sessionId,
      (chunk) => {
        setIsConnected(true);
        setError(null);
        handleIncomingToken(chunk);
      },
      (errMsg) => {
        setError(errMsg);
        setIsConnected(false);
      }
    );
    wsRef.current.connect();

    return () => {
      wsRef.current?.disconnect();
    };
  }, [sessionId, handleIncomingToken]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'student',
      text: input,
      timestamp: new Date()
    };

    setMessages((prev) => {
      const finalized = prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
      return [...finalized, userMsg];
    });

    wsRef.current.sendPrompt(input);
    setInput('');
  };

  return (
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header Banner */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="cardInner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="oauthIcon" style={{ color: 'var(--c-navy)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="pageTitle">Socratic Sandbox</h2>
              <div className="pageSub" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#22c55e' : '#ffc107',
                  boxShadow: isConnected ? '0 0 8px #22c55e' : '0 0 8px #ffc107'
                }} />
                {isConnected ? 'Active Safety Guardrails Enforced' : 'Connecting to Edge Safety Mesh...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="toast toastError" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => wsRef.current?.connect()} className="btn btnGhost iconBtn" style={{ width: '32px', height: '32px' }}>
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {/* Chat Messages Feed */}
      <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.sender === 'student' ? 'flex-end' : 'flex-start',
                width: '100%'
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  fontSize: '14px',
                  lineHeight: '1.45',
                  boxShadow: 'var(--shadow-sm)',
                  background: msg.sender === 'student' ? 'var(--c-navy)' : 'rgba(255, 255, 255, 0.95)',
                  color: msg.sender === 'student' ? 'var(--c-white)' : 'var(--text)',
                  border: msg.sender === 'student' ? 'none' : '1px solid var(--border)',
                  borderBottomRightRadius: msg.sender === 'student' ? '2px' : '16px',
                  borderBottomLeftRadius: msg.sender === 'student' ? '16px' : '2px',
                }}
              >
                {msg.text}
                {msg.isStreaming && (
                  <span style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '14px',
                    marginLeft: '6px',
                    background: 'var(--c-gold)',
                    verticalAlign: 'middle',
                    borderRadius: '2px'
                  }} />
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a conceptual question or explain your reasoning..."
          className="input"
          style={{ flex: 1, padding: '14px 18px', borderRadius: '18px' }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="btn btnPrimary"
          style={{ width: '50px', height: '50px', borderRadius: '18px', padding: 0 }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
