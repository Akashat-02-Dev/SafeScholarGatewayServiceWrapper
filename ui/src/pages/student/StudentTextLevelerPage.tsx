import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/authService';
import { aiService } from '../../services/aiService';
import { 
  BookOpen, Sparkles, Volume2, Loader2, Lightbulb
} from 'lucide-react';

const GRADE_LEVELS = [
  { id: 'Prep', label: 'Prep / Foundation', emoji: '🌱' },
  { id: 'Year 1', label: 'Year 1', emoji: '⭐' },
  { id: 'Year 2', label: 'Year 2', emoji: '🚀' },
  { id: 'Year 3', label: 'Year 3', emoji: '📘' },
  { id: 'Year 4', label: 'Year 4', emoji: '🔬' },
  { id: 'Year 5', label: 'Year 5', emoji: '🎓' },
];

export const StudentTextLevelerPage: React.FC = () => {
  const { me } = useAuth();
  const institutionId = me?.institutionId || 'default-inst';

  const [inputStory, setInputStory] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('Year 3');
  const [isLeveling, setIsLeveling] = useState(false);
  const [simplifiedText, setSimplifiedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleSimplify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputStory.trim()) return;

    setIsLeveling(true);
    setError(null);
    setSimplifiedText('');

    try {
      const prompt = `Rewrite this reading passage so it is easy and engaging for a student in Australian ${selectedGrade} to understand. Use Australian spelling (colour, organise). Highlight challenging vocabulary words in bold markdown. At the end, add 2 fun check-in questions to test understanding: ${inputStory}`;
      const res = await aiService.levelText(institutionId, selectedGrade, prompt);
      setSimplifiedText(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not simplify text right now. Please try again!');
    } finally {
      setIsLeveling(false);
    }
  };

  const handleReadAloud = () => {
    if (!simplifiedText) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(simplifiedText.replace(/\*\*/g, ''));
      utterance.lang = 'en-AU';
      utterance.rate = 0.9;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      {/* Header Banner */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden mb-6">
        <div className="cardInner p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 shrink-0">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Student Reading Helper</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 uppercase tracking-wide">
                  Text Leveler
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Paste any article, homework page, or story to adapt it to your exact reading level!
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input */}
        <div className="lg:col-span-5">
          <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Lightbulb size={16} className="text-cyan-500" /> Choose Your Year Level
            </h3>

            {/* Year Level Pills */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {GRADE_LEVELS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGrade(g.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    selectedGrade === g.id
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 shadow-sm'
                      : 'border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  <span className="text-base">{g.emoji}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSimplify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  Paste Hard or Tricky Text Here:
                </label>
                <textarea
                  rows={6}
                  value={inputStory}
                  onChange={(e) => setInputStory(e.target.value)}
                  placeholder="Paste your science reading, history text, or article excerpt here..."
                  required
                  className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none leading-relaxed"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLeveling || !inputStory.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLeveling ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Making Text Easier...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Level & Simplify Text</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Output */}
        <div className="lg:col-span-7">
          {simplifiedText ? (
            <div className="card shadow-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8">
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Leveled for {selectedGrade}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleReadAloud}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
                    isPlayingAudio
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  <Volume2 size={14} className={isPlayingAudio ? 'animate-bounce' : ''} />
                  <span>{isPlayingAudio ? 'Reading Aloud...' : 'Listen to Reading'}</span>
                </button>
              </div>

              {/* Text Body */}
              <div className="prose dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
                {simplifiedText}
              </div>
            </div>
          ) : (
            <div className="card shadow-lg border border-dashed border-slate-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[360px]">
              <div className="w-14 h-14 rounded-2xl bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <BookOpen size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Ready to Level Your Text</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                Paste any difficult reading text on the left, pick your year level, and click Simplify to get a clear, friendly version!
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StudentTextLevelerPage;
