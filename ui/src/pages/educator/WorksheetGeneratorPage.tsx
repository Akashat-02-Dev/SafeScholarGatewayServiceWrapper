import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/authService';
import { aiService } from '../../services/aiService';
import type { WorksheetSchema } from '../../types/aios';
import { 
  FileSpreadsheet, Sparkles, Printer, Copy, Check, 
  Eye, EyeOff, Layers, BookOpen, AlertCircle, Loader2
} from 'lucide-react';

const AC_YEAR_LEVELS = [
  'Prep / Foundation',
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5'
];

const SUBJECTS = [
  'English (Literacy & Reading)',
  'Mathematics (Numeracy)',
  'Science (Biological & Physical)',
  'HASS (History & Geography)',
  'Technologies & Digital Literacy',
  'The Arts & Visual Literacy'
];

export const WorksheetGeneratorPage: React.FC = () => {
  const { me } = useAuth();
  const institutionId = me?.institutionId || 'default-inst';

  // Form State
  const [gradeLevel, setGradeLevel] = useState('Year 3');
  const [subject, setSubject] = useState('Mathematics (Numeracy)');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  
  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [worksheet, setWorksheet] = useState<WorksheetSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError(null);
    setWorksheet(null);

    try {
      const res = await aiService.generateWorksheet(
        institutionId,
        gradeLevel,
        subject,
        topic,
        details || 'Australian Curriculum Prep to Year 5 aligned worksheet'
      );
      setWorksheet(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate worksheet. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!worksheet) return;
    const text = JSON.stringify(worksheet, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      {/* Header Banner */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden mb-6 print:hidden">
        <div className="cardInner p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20 shrink-0">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Worksheet Generator</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wide">
                    ACARA v9.0
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Kura Plan & Magic School AI inspired printable worksheets for Australian Prep to Year 5.
                </p>
              </div>
            </div>
            
            {worksheet && (
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setShowAnswerKey(!showAnswerKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm"
                >
                  {showAnswerKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showAnswerKey ? 'Hide Answers' : 'Show Answer Key'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md"
                >
                  <Printer size={14} />
                  <span>Print Worksheet</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column */}
        <div className="lg:col-span-5 print:hidden">
          <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers size={16} className="text-orange-500" /> Lesson Parameters
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Australian Grade Band</label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {AC_YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Learning Area / Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Worksheet Topic / Unit Focus *</label>
                <input
                  type="text"
                  placeholder="e.g. Fractions on a Number Line, Australian Habitats"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Specific Instructions / Differentiation</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Include 4 word problems and 1 early finisher extension challenge. Use Australian vocabulary."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating || !topic.trim()}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Designing Worksheet...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate Worksheet</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Preview Column */}
        <div className="lg:col-span-7 print:col-span-12">
          {worksheet ? (
            <div className="card shadow-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 print:p-0 print:border-none print:shadow-none">
              {/* Header block for Student Print */}
              <div className="border-b-2 border-slate-800 dark:border-slate-300 pb-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{worksheet.title}</h1>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold flex items-center gap-3">
                      <span>{worksheet.subject}</span>
                      <span>•</span>
                      <span>{worksheet.grade_level}</span>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400">{worksheet.aligned_standards?.join(', ')}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500 font-mono">
                    <div>Name: ______________________</div>
                    <div className="mt-2">Date: ______________________</div>
                  </div>
                </div>

                {worksheet.student_instructions && (
                  <div className="mt-4 p-3 bg-amber-50/70 dark:bg-zinc-800/60 border border-amber-200/60 dark:border-zinc-700 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold">Instructions: </span>{worksheet.student_instructions}
                  </div>
                )}
              </div>

              {/* Worksheet Sections */}
              <div className="space-y-6">
                {(worksheet.exercises || []).map((sec, sIdx) => (
                  <div key={sIdx} className="border border-slate-200 dark:border-zinc-700/80 rounded-2xl p-4 sm:p-5 bg-slate-50/50 dark:bg-zinc-800/30">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{sec.section_name}</h3>
                    {sec.instructions && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-4">{sec.instructions}</p>
                    )}

                    <div className="space-y-4">
                      {(sec.questions || []).map((q, qIdx) => (
                        <div key={qIdx} className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-orange-600 dark:text-orange-400">{q.number || qIdx + 1}.</span>
                            <div className="flex-1">
                              <p className="font-medium">{q.prompt}</p>

                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 ml-2">
                                  {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs">
                                      <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] font-bold">
                                        {String.fromCharCode(65 + oIdx)}
                                      </span>
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Student Answer Line */}
                              <div className="mt-2.5 pt-2 border-b border-dashed border-slate-300 dark:border-zinc-700 w-full" />

                              {/* Teacher Answer Key (Conditionally Shown) */}
                              {showAnswerKey && q.answer && (
                                <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold print:hidden">
                                  ✓ Answer: {q.answer}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Differentiation callout */}
              {worksheet.differentiation && (
                <div className="mt-6 p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 print:hidden">
                  <h4 className="font-bold uppercase tracking-wider text-[10px] text-blue-700 dark:text-blue-300 mb-1">Teacher Differentiation Notes</h4>
                  {worksheet.differentiation.support_notes && (
                    <p className="mt-1"><span className="font-semibold">Support:</span> {worksheet.differentiation.support_notes}</p>
                  )}
                  {worksheet.differentiation.extension_notes && (
                    <p className="mt-1"><span className="font-semibold">Extension:</span> {worksheet.differentiation.extension_notes}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card shadow-lg border border-dashed border-slate-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[360px]">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
                <BookOpen size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Ready to Generate Worksheet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                Select your Australian year level and topic on the left to build a printable, curriculum-aligned student worksheet.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default WorksheetGeneratorPage;
