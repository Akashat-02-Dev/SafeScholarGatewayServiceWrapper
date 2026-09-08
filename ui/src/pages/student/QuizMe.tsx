import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface QuizGeneratorResponse {
  title: string;
  questions: QuizQuestion[];
}

type QuizState = 'idle' | 'loading' | 'active' | 'complete';

const flipVariants = {
  enter: { rotateX: -90, opacity: 0 },
  center: { rotateX: 0, opacity: 1 },
  exit: { rotateX: 90, opacity: 0 }
};

export function QuizMe() {
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Year 3');
  const [questionCount, setQuestionCount] = useState(5);
  
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [quizData, setQuizData] = useState<QuizGeneratorResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ selected: string; correct: boolean }[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTokens = () => {
    const raw = sessionStorage.getItem('safescholar.tokens.v1');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return { access: parsed.accessToken };
    } catch {
      return null;
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setQuizState('loading');
    setError(null);
    const tokens = getTokens();

    try {
      const host = import.meta.env.VITE_GATEWAY_HOST || window.location.host;
      const res = await fetch(`//${host}/api/v1/ai/student/quiz-generator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokens?.access ? { 'Authorization': `Bearer ${tokens.access}` } : {})
        },
        body: JSON.stringify({ parameters: { topic, grade_level: gradeLevel + ' (Australian Curriculum)', question_count: questionCount } })
      });

      if (!res.ok) {
        let errStr = 'An error occurred while generating the quiz.';
        try {
          const errJson = await res.json();
          errStr = errJson.message || errJson.error || errStr;
        } catch {
          // ignore parsing error
        }
        throw new Error(errStr);
      }

      const data = await res.json();
      const parsedResponse = JSON.parse(data.response_text) as QuizGeneratorResponse;
      setQuizData(parsedResponse);
      setCurrentQuestionIndex(0);
      setScore(0);
      setUserAnswers([]);
      setShowExplanation(false);
      setQuizState('active');
    } catch (err) {
      setError((err as Error).message);
      setQuizState('idle');
    }
  };

  const handleAnswerSelect = (option: string) => {
    if (showExplanation || !quizData) return;
    
    const currentQ = quizData.questions[currentQuestionIndex];
    const clean = (s: unknown) => String(s || '').replace(/^([A-Za-z0-9]+[.)])?\s*/i, '').trim().toLowerCase();
    const isCorrect = clean(option) === clean(currentQ.answer);
    
    if (isCorrect) setScore(prev => prev + 1);
    
    setUserAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = { selected: option, correct: isCorrect };
      return newAnswers;
    });
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    if (!quizData) return;
    if (currentQuestionIndex + 1 < quizData.questions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowExplanation(false);
    } else {
      setQuizState('complete');
    }
  };

  const resetQuiz = () => {
    setTopic('');
    setQuizState('idle');
    setQuizData(null);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] w-full p-4 sm:p-6">
      <div className="w-full max-w-3xl min-h-[500px] flex flex-col bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden perspective-1000">
        
        {/* State: IDLE */}
        {quizState === 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center flex-1 p-8 sm:p-12">
            <div className="p-5 bg-blue-50 dark:bg-zinc-800 rounded-full mb-8 shadow-inner border border-blue-100 dark:border-white/5">
              <Sparkles size={48} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3 font-serif">AI Quiz Me!</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-center max-w-md leading-relaxed text-lg">Enter a topic and let our AI generate a customized flashcard quiz just for you.</p>
            
            {error && (
              <div className="w-full p-4 bg-red-100/50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl mb-8 text-center font-semibold border border-red-200 dark:border-red-900">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerate} className="w-full max-w-md flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-2">Topic</label>
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-transparent focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all outline-none rounded-2xl px-5 py-3 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                  placeholder="e.g. Photosynthesis, World War II..."
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-2">Grade Level</label>
                  <select 
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-transparent focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all outline-none rounded-2xl px-4 py-3 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm appearance-none"
                  >
                    <option>Prep</option>
                    <option>Year 1</option>
                    <option>Year 2</option>
                    <option>Year 3</option>
                    <option>Year 4</option>
                    <option>Year 5</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-2">Questions</label>
                  <select 
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-transparent focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all outline-none rounded-2xl px-4 py-3 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm appearance-none"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>
              </div>
              <motion.button 
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-4 flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gradient-to-b from-blue-600 to-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-shadow"
              >
                <Sparkles size={18} />
                Generate Quiz
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* State: LOADING */}
        {quizState === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center flex-1 p-8">
            <Loader2 size={48} className="animate-spin text-blue-600 dark:text-blue-400 mb-6" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 font-serif">Generating your customized quiz...</h2>
            <p className="text-slate-500 dark:text-slate-400">Crafting questions about {topic}</p>
          </motion.div>
        )}

        {/* State: ACTIVE */}
        {quizState === 'active' && quizData && (
          <div className="flex flex-col flex-1 h-full">
            <div className="bg-black/5 dark:bg-white/5 px-6 py-5 border-b border-white/20 dark:border-white/10 flex justify-between items-center">
              <h2 className="m-0 text-lg font-bold text-slate-800 dark:text-slate-100">{quizData.title}</h2>
              <div className="text-sm font-bold text-slate-500 dark:text-slate-400 px-3 py-1 bg-white/50 dark:bg-zinc-800/50 rounded-full">
                Question {currentQuestionIndex + 1} of {quizData.questions.length}
              </div>
            </div>
            
            <div className="flex-1 p-6 sm:p-10 flex flex-col justify-center perspective-1000">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestionIndex}
                  variants={flipVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="w-full transform-style-3d"
                >
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-10 leading-snug">
                    {quizData.questions[currentQuestionIndex].question}
                  </h3>
                  
                  <div className="flex flex-col gap-4">
                    {quizData.questions[currentQuestionIndex].options.map((option, idx) => {
                      const clean = (s: unknown) => String(s || '').replace(/^([A-Za-z0-9]+[.)])?\s*/i, '').trim().toLowerCase();
                      const isSelected = showExplanation && userAnswers[currentQuestionIndex]?.selected === option;
                      const actualAnswer = quizData.questions[currentQuestionIndex].answer;
                      const isCorrect = showExplanation && (clean(option) === clean(actualAnswer));
                      
                      let baseClasses = "w-full px-6 py-4 text-left border rounded-2xl text-lg transition-all duration-200 outline-none ";
                      
                      if (!showExplanation) {
                        baseClasses += "bg-white/80 dark:bg-zinc-900/60 border-white/50 dark:border-white/5 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-md text-slate-700 dark:text-slate-200 cursor-pointer";
                      } else {
                        if (isCorrect) {
                          baseClasses += "bg-emerald-100/80 dark:bg-emerald-900/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 shadow-sm";
                        } else if (isSelected) {
                          baseClasses += "bg-red-100/80 dark:bg-red-900/40 border-red-500 text-red-900 dark:text-red-100 shadow-sm";
                        } else {
                          baseClasses += "bg-white/40 dark:bg-zinc-800/40 border-transparent text-slate-400 dark:text-slate-500 opacity-60 cursor-default";
                        }
                      }

                      return (
                        <button 
                          key={idx}
                          onClick={() => handleAnswerSelect(option)}
                          disabled={showExplanation}
                          className={baseClasses}
                        >
                          <div className="flex justify-between items-center">
                            <span>{option}</span>
                            {showExplanation && isCorrect && <CheckCircle size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-4" />}
                            {showExplanation && isSelected && !isCorrect && <XCircle size={24} className="text-red-600 dark:text-red-400 shrink-0 ml-4" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {showExplanation && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8"
                  >
                    <div className="p-6 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 rounded-3xl backdrop-blur-sm">
                      <h4 className="m-0 mb-2 text-lg font-bold text-amber-900 dark:text-amber-200">Explanation</h4>
                      <p className="m-0 text-amber-800/90 dark:text-amber-100/80 leading-relaxed">
                        {quizData.questions[currentQuestionIndex].explanation}
                      </p>
                    </div>
                    
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleNextQuestion}
                      className="w-full mt-6 px-6 py-4 rounded-full bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-bold shadow-lg"
                    >
                      {currentQuestionIndex + 1 < quizData.questions.length ? 'Next Question' : 'See Final Results'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* State: COMPLETE */}
        {quizState === 'complete' && quizData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center flex-1 p-8 sm:p-12">
            <div className="p-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-6 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle size={64} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            
            <h2 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-3 font-serif">Quiz Complete!</h2>
            <p className="text-xl text-slate-500 dark:text-slate-400 mb-10 font-medium">You scored {score} out of {quizData.questions.length}</p>
            
            <div className="w-full max-w-sm h-4 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-12 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(score / quizData.questions.length) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
              />
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetQuiz}
              className="flex items-center gap-2 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl transition-colors"
            >
              <Sparkles size={18} />
              Take Another Quiz
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
