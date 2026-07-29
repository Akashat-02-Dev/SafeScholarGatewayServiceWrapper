'use client';

import { useCallback, useRef, useState } from 'react';

import { useSocraticChat } from '@/hooks/useGateway';
import type { SocraticChatMessage, SocraticSubject } from '@/lib/types/gateway';

/**
 * SocraticChatPanel — the full chat UI for the SafeScholar Socratic tutor.
 *
 * Features:
 *   - Streaming-style message display (typing indicator while waiting)
 *   - Conversation history maintained client-side and sent with each request
 *   - Content-filter warnings displayed inline when messages are blocked
 *   - Subject selector to focus the tutor on a specific area
 *   - Auto-scroll to the latest message
 *   - Enter to send, Shift+Enter for newline
 */

interface ChatDisplayMessage extends SocraticChatMessage {
  id: string;
  flagged?: boolean;
  warning?: string;
}

const SUBJECT_OPTIONS: { value: SocraticSubject; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'science', label: 'Science' },
  { value: 'history', label: 'History' },
  { value: 'literature', label: 'Literature' },
  { value: 'computer-science', label: 'Computer Science' },
  { value: 'languages', label: 'Languages' },
  { value: 'social-studies', label: 'Social Studies' },
  { value: 'arts', label: 'Arts' },
];

export default function SocraticChatPanel() {
  const { execute, loading, error } = useSocraticChat();
  const [messages, setMessages] = useState<ChatDisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [subject, setSubject] = useState<SocraticSubject>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    // Add user message to display
    const userMsg: ChatDisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    // Build history from existing messages (exclude flagged warnings)
    const history: SocraticChatMessage[] = messages
      .filter((m) => !m.flagged)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    scrollToBottom();

    // Call the gateway
    const res = await execute({
      message: trimmed,
      history,
      subject,
    });

    if (res.ok) {
      const assistantMsg: ChatDisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.data.reply,
        flagged: res.data.flagged,
        warning: res.data.warning,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } else {
      const errorMsg: ChatDisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.error.message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
    scrollToBottom();
  }, [input, loading, messages, subject, execute, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🧠 SafeScholar Socratic Tutor</h2>
          <p style={styles.subtitle}>
            Learn through guided questions — the Socratic way.
          </p>
        </div>
        <button onClick={handleClear} style={styles.clearButton} title="Clear conversation">
          Clear
        </button>
      </div>

      {/* Subject Selector */}
      <div style={styles.subjectBar}>
        <label style={styles.subjectLabel}>Subject:</label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value as SocraticSubject)}
          style={styles.select}
        >
          {SUBJECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📚</p>
            <p style={{ color: '#6b7280', fontSize: 15 }}>
              Hi! I'm your SafeScholar tutor. I'll help you learn by asking
              guiding questions rather than just giving answers.
            </p>
            <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>
              Try: "Can you explain photosynthesis?" or "I'm stuck on quadratic equations."
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.messageRow,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                ...styles.messageBubble,
                background: msg.role === 'user' ? '#2563eb' : msg.flagged ? '#fef3c7' : '#f3f4f6',
                color: msg.role === 'user' ? '#fff' : msg.flagged ? '#92400e' : '#1f2937',
                borderColor: msg.flagged ? '#f59e0b' : 'transparent',
              }}
            >
              {msg.role === 'assistant' && (
                <span style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', opacity: 0.7 }}>
                  {msg.flagged ? '⚠ Tutor' : '🧠 Tutor'}
                </span>
              )}
              <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              {msg.warning && (
                <div style={styles.warningBadge}>{msg.warning}</div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div style={{ ...styles.messageBubble, background: '#f3f4f6' }}>
              <span style={styles.typingDots}>
                <span style={styles.dot1}>●</span>
                <span style={styles.dot2}>●</span>
                <span style={styles.dot3}>●</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputBar}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your studies… (Enter to send, Shift+Enter for newline)"
          style={styles.textarea}
          rows={2}
          disabled={loading}
          maxLength={4000}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            ...styles.sendButton,
            opacity: loading || !input.trim() ? 0.5 : 1,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>

      {/* Char counter */}
      <div style={styles.charCounter}>
        {input.length} / 4000
      </div>

      {error && (
        <div style={styles.errorBar}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (no CSS framework dependency — works in any Next.js app)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 760,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    height: '85vh',
    minHeight: 500,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
  },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: '#1f2937' },
  subtitle: { fontSize: 13, color: '#6b7280', margin: '4px 0 0 0' },
  clearButton: {
    padding: '6px 14px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    color: '#6b7280',
  },
  subjectBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
  },
  subjectLabel: { fontSize: 13, color: '#6b7280', fontWeight: 500 },
  select: {
    padding: '4px 10px',
    fontSize: 13,
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  welcome: {
    textAlign: 'center',
    marginTop: 60,
    padding: '0 40px',
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.5,
    border: '2px solid transparent',
  },
  warningBadge: {
    marginTop: 8,
    padding: '4px 8px',
    fontSize: 12,
    background: 'rgba(245,158,11,0.15)',
    borderRadius: 6,
    color: '#92400e',
  },
  typingDots: {
    display: 'inline-flex',
    gap: 4,
    fontSize: 18,
    color: '#9ca3af',
  },
  dot1: { animation: 'blink 1.4s infinite', animationDelay: '0s' },
  dot2: { animation: 'blink 1.4s infinite', animationDelay: '0.2s' },
  dot3: { animation: 'blink 1.4s infinite', animationDelay: '0.4s' },
  inputBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid #e5e7eb',
    background: '#f9fafb',
  },
  textarea: {
    flex: 1,
    padding: '8px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '8px 24px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
  },
  charCounter: {
    textAlign: 'right',
    padding: '0 20px 8px',
    fontSize: 11,
    color: '#9ca3af',
  },
  errorBar: {
    margin: '0 20px 12px',
    padding: '8px 12px',
    borderRadius: 6,
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: 13,
  },
};
