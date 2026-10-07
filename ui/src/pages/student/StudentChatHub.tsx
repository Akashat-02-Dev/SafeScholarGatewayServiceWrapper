import React, { useState, useEffect, useRef } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { Send, Bot, User, Search, AlertTriangle } from 'lucide-react';
import { WSTutorService, type ConnectionState } from '../../services/wsTutorService';
import { CitationRenderer } from '../../components/CitationRenderer';

interface Message {
  id: string;
  sender: 'ai' | 'student';
  text: string;
  isStreaming?: boolean;
}

interface ChatHubProps {
  mode: 'custom' | 'character' | 'research';
  botId?: string;
  botName?: string;
}

export function StudentChatHub({ mode, botId, botName }: ChatHubProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const wsServiceRef = useRef<WSTutorService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Early exit handling for WebSocket to prevent race conditions during framer-motion unmount
    if (!isPresent && wsServiceRef.current) {
      wsServiceRef.current.disconnect();
      wsServiceRef.current = null;
    }
  }, [isPresent]);

  useEffect(() => {
    if (!isPresent) return;
    
    // Generate a random session ID for this demo
    const sessionId = `student-hub-${Math.random().toString(36).substring(7)}`;

    const handleMessage = (chunk: string, isDone: boolean) => {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.sender === 'ai' && lastMsg.isStreaming) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastMsg,
            text: lastMsg.text + chunk,
            isStreaming: !isDone
          };
          return updated;
        } else {
          return [
            ...prev,
            { id: Date.now().toString(), sender: 'ai', text: chunk, isStreaming: !isDone }
          ];
        }
      });
    };

    const handleError = (errMsg: string) => {
      setError(errMsg);
    };

    const handleState = (state: ConnectionState) => {
      setConnectionState(state);
      if (state === 'connected') {
        setError(null);
      }
    };

    // Strict React 18 readiness checks to prevent double-connect race conditions
    if (!wsServiceRef.current) {
      wsServiceRef.current = new WSTutorService(
        sessionId,
        handleMessage,
        handleError,
        handleState,
        mode,
        botId
      );
      wsServiceRef.current.connect();
    }

    return () => {
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
        wsServiceRef.current = null;
      }
    };
  }, [mode, botId, isPresent]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || connectionState !== 'connected') return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'student',
      text: input.trim()
    };
    
    setMessages(prev => [...prev, userMsg]);
    wsServiceRef.current?.sendPrompt(input.trim());
    setInput('');
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'character': return <User size={24} className="text-purple-600 dark:text-purple-400" />;
      case 'research': return <Search size={24} className="text-teal-600 dark:text-teal-400" />;
      default: return <Bot size={24} className="text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const getModeTitle = () => {
    if (botName) return botName;
    switch (mode) {
      case 'character': return "Historical Figure";
      case 'research': return "Research Assistant";
      default: return "AI Tutor";
    }
  };

  return (
    <div className="flex items-center justify-center h-[calc(100vh-120px)] w-full p-4 sm:p-6">
      <div className="flex flex-col w-full max-w-4xl h-full bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/20 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-full shadow-sm">
              {getModeIcon()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{getModeTitle()}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'} ${connectionState !== 'connected' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 capitalize">{connectionState}</span>
              </div>
            </div>
          </div>
          
          {mode === 'custom' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100/50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold">
              <AlertTriangle size={14} />
              Teacher Monitored
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 px-6 py-3 bg-red-100/50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-b border-red-200/50 dark:border-red-900/50 text-sm font-bold"
          >
            <AlertTriangle size={16} />
            {error}
          </motion.div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-white/20 dark:bg-black/20">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-4">
              <div className="opacity-30 scale-150">{getModeIcon()}</div>
              <p className="text-lg font-medium">Start a conversation to begin learning.</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`
                max-w-[85%] sm:max-w-[75%] px-5 py-4 shadow-sm
                ${msg.sender === 'student' 
                  ? 'bg-blue-600 dark:bg-blue-700 text-white rounded-2xl rounded-tr-sm' 
                  : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm border border-slate-200/50 dark:border-white/10'}
              `}>
                {msg.sender === 'ai' ? (
                  <CitationRenderer text={msg.text} />
                ) : (
                  <p className="m-0 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                )}
                {msg.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-slate-400 dark:bg-slate-500 align-middle animate-pulse" />
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 bg-white/50 dark:bg-zinc-900/50 border-t border-white/30 dark:border-white/10">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={connectionState !== 'connected'}
              placeholder="Type your message here..."
              className="w-full bg-zinc-100/50 dark:bg-zinc-800/50 border-transparent focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all outline-none rounded-full px-6 py-4 pr-16 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-inner"
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || connectionState !== 'connected'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="absolute right-2 flex items-center justify-center w-11 h-11 rounded-full bg-blue-600 dark:bg-blue-700 text-white shadow-md disabled:opacity-50 disabled:transform-none"
            >
              <Send size={18} className="ml-1" />
            </motion.button>
          </form>
        </div>
      </div>
    </div>
  );
}
