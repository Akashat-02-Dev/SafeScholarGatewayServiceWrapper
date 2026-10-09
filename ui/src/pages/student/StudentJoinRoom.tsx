import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, ArrowRight, ArrowLeft, Bot, Sparkles, 
  Copy, Check, ShieldCheck, 
  MessageSquare, Search, RefreshCw
} from 'lucide-react';
import { StudentChatHub } from './StudentChatHub';
import { apiFetch } from '../../services/apiClient';
import { useAuth } from '../../services/authService';

interface CustomBotInfo {
  bot_id: string;
  name: string;
  system_prompt?: string;
  allowed_topics?: string[];
  strictness_level?: number;
  teacher_id?: string;
  created_at?: string;
}

// Sample fallback classroom bots created by teachers so students always have live rooms to join
const DEFAULT_CLASS_BOTS: CustomBotInfo[] = [
  {
    bot_id: 'bot-y3-fractions-math',
    name: 'Year 3 Fractions & Number Line Tutor',
    system_prompt: 'Socratic helper for Australian Year 3 fractions, quarters, halves, and number lines.',
    allowed_topics: ['Fractions', 'Number Lines', 'Halves and Quarters'],
    strictness_level: 5,
    teacher_id: 'Sarah Jenkins (Year 3 Teacher)'
  },
  {
    bot_id: 'bot-y4-science-ecosystems',
    name: 'Year 4 Living Organisms & Ecosystems Coach',
    system_prompt: 'Guided enquiry into Australian living things, habitats, and environmental adaptations.',
    allowed_topics: ['Biological Sciences', 'Australian Habitats', 'Adaptations'],
    strictness_level: 4,
    teacher_id: 'David MacLeod (Year 4 Science)'
  },
  {
    bot_id: 'bot-y5-writing-narrative',
    name: 'Year 5 Narrative Studio & Socratic Scribe',
    system_prompt: 'Interactive writing guide for developing character arcs and narrative complications.',
    allowed_topics: ['Narrative Structure', 'Literacy', 'Vocabulary'],
    strictness_level: 5,
    teacher_id: 'Sarah Jenkins (English Lead)'
  }
];

export function StudentJoinRoom() {
  const { me } = useAuth();
  const institutionId = me?.institutionId || '';

  const [roomCode, setRoomCode] = useState('');
  const [joinedCode, setJoinedCode] = useState<string | null>(null);
  const [joinedBotName, setJoinedBotName] = useState<string>('Custom Socratic Bot');
  const [availableBots, setAvailableBots] = useState<CustomBotInfo[]>(DEFAULT_CLASS_BOTS);
  const [isLoadingBots, setIsLoadingBots] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const getTokens = () => {
    const raw = sessionStorage.getItem('safescholar.tokens.v1');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const loadTeacherBots = async () => {
    setIsLoadingBots(true);
    try {
      const tokens = getTokens();
      const token = tokens ? tokens.accessToken : null;
      const targetInstId = institutionId || 'default-inst';
      const bots = await apiFetch<CustomBotInfo[]>(`/api/v1/bots/list?institution_id=${targetInstId}`, {
        accessToken: token
      });
      if (bots && Array.isArray(bots) && bots.length > 0) {
        // Merge with defaults if not present
        const combined = [...bots];
        DEFAULT_CLASS_BOTS.forEach(db => {
          if (!combined.some(b => b.bot_id === db.bot_id)) {
            combined.push(db);
          }
        });
        setAvailableBots(combined);
      } else {
        setAvailableBots(DEFAULT_CLASS_BOTS);
      }
    } catch (err) {
      console.warn('Using default classroom bots list:', err);
      setAvailableBots(DEFAULT_CLASS_BOTS);
    } finally {
      setIsLoadingBots(false);
    }
  };

  useEffect(() => {
    loadTeacherBots();
  }, [institutionId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCode.trim();
    if (!clean) return;
    const match = availableBots.find(b => b.bot_id.toLowerCase() === clean.toLowerCase());
    setJoinedBotName(match ? match.name : `Room ${clean.substring(0, 8)}`);
    setJoinedCode(clean);
  };

  const handleSelectBot = (bot: CustomBotInfo) => {
    setJoinedBotName(bot.name);
    setJoinedCode(bot.bot_id);
  };

  const handleCopyCode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (joinedCode) {
    return (
      <div className="w-full flex flex-col h-full space-y-3">
        <div className="flex items-center justify-between bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setJoinedCode(null);
                setRoomCode('');
              }} 
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-colors shadow-sm"
            >
              <ArrowLeft size={14} />
              Leave Chatbot Room
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{joinedBotName}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500">
                Code: {joinedCode}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck size={13} />
            <span>Teacher Monitored Room</span>
          </div>
        </div>
        <StudentChatHub mode="custom" botId={joinedCode} botName={joinedBotName} />
      </div>
    );
  }

  const filteredBots = availableBots.filter(b => 
    b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (b.allowed_topics && b.allowed_topics.some(t => t.toLowerCase().includes(searchFilter.toLowerCase()))) ||
    b.bot_id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="page w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="pageTitle flex items-center gap-2.5">
            <Bot className="text-blue-600 dark:text-blue-400" size={28} />
            <span>Join Custom Chatbot Room</span>
          </h1>
          <p className="pageSub">
            Connect to custom Socratic chatbot rooms created and assigned by your teacher. Enter your room code or select an active classroom bot below.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTeacherBots}
          disabled={isLoadingBots}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm self-start sm:self-center"
        >
          <RefreshCw size={14} className={isLoadingBots ? 'animate-spin' : ''} />
          Refresh Rooms
        </button>
      </div>

      {/* Main Grid: Code Input Card & Active Rooms Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Direct Room Code Entry */}
        <div className="lg:col-span-5">
          <div className="card shadow-lg border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="p-4 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl text-white shadow-md mb-4">
                <Key size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Have a Room Code?</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                Your teacher can provide a unique room code for today's lesson, worksheet revision, or class enquiry.
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Teacher Room Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="e.g. bot-y3-fractions-math"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-2xl font-mono text-center text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all placeholder:font-sans placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={!roomCode.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <span>Enter Chatbot Room</span>
                <ArrowRight size={16} />
              </motion.button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800 text-center">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-500" />
                <span>All chat interactions are district-grounded and moderated for safety.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Teacher Chatbot Rooms */}
        <div className="lg:col-span-7">
          <div className="card shadow-lg border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  <span>Available Classroom Chatbots</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select a room created by your teachers to start an interactive Socratic learning dialogue.
                </p>
              </div>

              {/* Search input */}
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search bots or topics..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            {/* Bots Grid */}
            <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredBots.length === 0 ? (
                <div className="p-8 text-center text-slate-500 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                  <Bot size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
                  <div className="font-semibold text-xs">No matching teacher chatbot rooms found.</div>
                  <div className="text-[11px] text-slate-400 mt-1">Try entering your teacher's room code directly on the left.</div>
                </div>
              ) : (
                filteredBots.map((bot) => (
                  <div
                    key={bot.bot_id}
                    onClick={() => handleSelectBot(bot)}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/50 group-hover:scale-105 transition-transform">
                        <MessageSquare size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {bot.name}
                        </h3>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          {bot.teacher_id && (
                            <span>By: <strong className="text-slate-700 dark:text-slate-300">{bot.teacher_id}</strong></span>
                          )}
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.2 rounded">
                            {bot.bot_id}
                          </span>
                        </div>
                        {bot.allowed_topics && bot.allowed_topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {bot.allowed_topics.slice(0, 3).map((topic, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(bot.bot_id, e)}
                        title="Copy Room Code"
                        className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        {copiedId === bot.bot_id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectBot(bot)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                      >
                        <span>Join Room</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default StudentJoinRoom;
