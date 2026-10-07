import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, FileText, CheckCircle } from 'lucide-react';

interface FeedbackPoint {
  category: string;
  comment: string;
}

interface WritingFeedbackResponse {
  feedback_points: FeedbackPoint[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export function WritingStudio() {
  const [draft, setDraft] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getTokens = () => {
    const raw = sessionStorage.getItem('safescholar.tokens.v1');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return { access: parsed.accessToken, institution: parsed.institutionId };
    } catch {
      return null;
    }
  };

  const handleAnalyze = async () => {
    if (!draft.trim()) return;
    setIsAnalyzing(true);
    setFeedback(null);
    setError(null);

    const tokens = getTokens();
    if (!tokens?.access) {
      setError('Please log in to your account to use Writing Studio.');
      setIsAnalyzing(false);
      return;
    }

    try {
      const host = import.meta.env.VITE_GATEWAY_HOST || window.location.host;
      const res = await fetch(`//${host}/api/v1/ai/student/writing-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens.access}`
        },
        body: JSON.stringify({ parameters: { draft_text: draft } })
      });

      if (!res.ok) {
        let errStr = 'An error occurred';
        try {
          const errJson = await res.json();
          errStr = errJson.message || errJson.error || errStr;
        } catch {
          // fallback
        }
        throw new Error(errStr);
      }

      const data = await res.json();
      const parsedResponse = JSON.parse(data.response_text) as WritingFeedbackResponse;
      setFeedback(parsedResponse.feedback_points);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-120px)] p-4 sm:p-6 w-full max-w-7xl mx-auto">
      {/* Left Pane - Editor */}
      <div className="flex flex-col bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
        <div className="px-6 py-5 border-b border-white/20 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-3 text-blue-900 dark:text-blue-100">
            <FileText size={20} />
            <h2 className="text-xl font-bold m-0">Writing Studio</h2>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAnalyze}
            disabled={isAnalyzing || !draft.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-b from-blue-900 to-blue-800 text-white font-medium shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:transform-none"
          >
            {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Get Feedback
          </motion.button>
        </div>
        <div className="flex-1 p-6 flex flex-col">
          <textarea
            className="flex-1 w-full bg-transparent text-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-none border-none shadow-[inset_0_4px_24px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_4px_24px_rgba(0,0,0,0.1)] rounded-3xl p-6 transition-shadow focus:shadow-[inset_0_4px_30px_rgba(0,0,0,0.04)] dark:focus:shadow-[inset_0_4px_30px_rgba(0,0,0,0.2)]"
            placeholder="Start drafting your essay, story, or report here..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
      </div>

      {/* Right Pane - AI Feedback */}
      <div className="flex flex-col bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl -webkit-backdrop-filter transform-gpu border border-white/30 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-white/20 dark:border-white/10">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">AI Writing Coach</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="px-5 py-4 bg-red-100/50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl mb-6 text-sm font-semibold">
              {error}
            </div>
          )}

          {isAnalyzing && (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {feedback && !isAnalyzing && (
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-4"
              >
                {feedback.map((point, idx) => (
                  <motion.div 
                    variants={itemVariants}
                    key={idx} 
                    className="p-5 bg-white/70 dark:bg-zinc-800/70 border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={18} className="text-emerald-500" />
                      <span className="font-bold text-slate-800 dark:text-slate-100 capitalize">{point.category}</span>
                    </div>
                    <p className="m-0 text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{point.comment}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!isAnalyzing && !feedback && !error && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 min-h-[300px]">
              <Sparkles size={48} className="opacity-20 mb-4" />
              <p className="font-medium text-center max-w-[250px]">Write your draft and click "Get Feedback" to see suggestions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
