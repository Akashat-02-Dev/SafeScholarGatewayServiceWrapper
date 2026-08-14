import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, ArrowRight, ArrowLeft } from 'lucide-react';
import { StudentChatHub } from './StudentChatHub';

export function StudentJoinRoom() {
  const [roomCode, setRoomCode] = useState('');
  const [joinedCode, setJoinedCode] = useState<string | null>(null);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      setJoinedCode(roomCode.trim());
    }
  };

  if (joinedCode) {
    return (
      <div className="w-full flex flex-col h-full">
        <div className="mb-4">
          <button 
            onClick={() => setJoinedCode(null)} 
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-colors border border-slate-200 dark:border-white/5 shadow-sm w-fit"
          >
            <ArrowLeft size={16} />
            Leave Room
          </button>
        </div>
        <StudentChatHub mode="custom" botId={joinedCode} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] w-full p-4 sm:p-6">
      <div className="w-full max-w-lg min-h-[400px] flex flex-col bg-white/60 dark:bg-zinc-900/40 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/[0.04] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-glass-dark overflow-hidden p-8 sm:p-12">
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="p-5 bg-blue-50 dark:bg-zinc-800 rounded-full mb-8 shadow-inner border border-blue-100 dark:border-white/5">
            <Key size={48} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3 font-serif">Join Socratic Room</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-center leading-relaxed text-lg">
            Enter the custom bot room code provided by your teacher.
          </p>

          <form onSubmit={handleJoin} className="w-full flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-2">Room Code</label>
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-transparent focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all outline-none rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm text-center font-mono text-xl tracking-wider"
                placeholder="e.g. 9f8a..."
                required
              />
            </div>
            
            <motion.button 
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gradient-to-b from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white font-bold shadow-md hover:shadow-lg transition-shadow"
            >
              Join Room
              <ArrowRight size={18} />
            </motion.button>
          </form>
        </div>
      </div>
    </div>
  );
}
