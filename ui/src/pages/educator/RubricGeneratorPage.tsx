import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/authService';
import { aiService } from '../../services/aiService';
import { 
  FileText, Sparkles, Printer, Copy, Check, 
  Layers, AlertCircle, Loader2, Award
} from 'lucide-react';
import { LMSExportButton } from '../../components/LMSExportButton';

const YEAR_LEVELS = [
  'Prep / Foundation',
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5'
];

const RUBRIC_TYPES = [
  'Australian Curriculum Standards Rubric (4-Tier)',
  'QCAA ISMG Criteria Guide (A-E Scale)',
  'Formative Diagnostic Assessment Matrix',
  'Inquiry & Project-Based Rubric'
];

interface PerformanceLevel {
  mark_range: string;
  description: string;
}

interface Criterion {
  criterion_name: string;
  performance_levels: PerformanceLevel[];
}

interface RubricData {
  assessment_title: string;
  instrument_type: string;
  ismg_criteria: Criterion[];
}

export const RubricGeneratorPage: React.FC = () => {
  const { me } = useAuth();
  const institutionId = me?.institutionId || 'default-inst';

  // Form State
  const [gradeLevel, setGradeLevel] = useState('Year 4');
  const [subject, setSubject] = useState('English Literacy');
  const [rubricType, setRubricType] = useState('Australian Curriculum Standards Rubric (4-Tier)');
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [details, setDetails] = useState('');

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [rubric, setRubric] = useState<RubricData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentTitle.trim()) return;

    setIsGenerating(true);
    setError(null);
    setRubric(null);

    try {
      const userPrompt = `Grade: ${gradeLevel}. Rubric Type: ${rubricType}. Assessment Title: ${assessmentTitle}. Details: ${details || 'Comprehensive Australian Curriculum rubric with QCAA cognitive verbs.'}`;
      const res = await aiService.generateRubric(institutionId, subject, rubricType, userPrompt);
      setRubric(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate rubric. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!rubric) return;
    navigator.clipboard.writeText(JSON.stringify(rubric, null, 2));
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
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Rubric Generator</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                    QCAA / ISMG
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Generate criterion-referenced rubrics with clear cognitive verbs and performance bands for Prep to Year 5.
                </p>
              </div>
            </div>

            {rubric && (
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Schema'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md"
                >
                  <Printer size={14} />
                  <span>Print Rubric</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form */}
        <div className="lg:col-span-5 print:hidden">
          <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers size={16} className="text-emerald-500" /> Rubric Parameters
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Australian Grade Band</label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Rubric Framework</label>
                <select
                  value={rubricType}
                  onChange={(e) => setRubricType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {RUBRIC_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Subject / Learning Area</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. English, Science, Mathematics"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Assessment Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Narrative Writing Task, Plant Adaptation Investigation"
                  value={assessmentTitle}
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Specific Criteria & Skill Focus</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Criteria: 1. Text Structure & Cohesion, 2. Vocabulary & QCAA Cognitive Verbs, 3. Editing & Punctuation."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
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
                disabled={isGenerating || !assessmentTitle.trim()}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Synthesizing Rubric...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate Rubric</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Output */}
        <div className="lg:col-span-7 print:col-span-12">
          {rubric ? (
            <div className="card shadow-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 print:p-0 print:border-none print:shadow-none">
              <div className="border-b-2 border-slate-800 dark:border-slate-300 pb-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{rubric.assessment_title}</h1>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold flex items-center gap-3">
                      <span>{subject}</span>
                      <span>•</span>
                      <span>{gradeLevel}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{rubric.instrument_type}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500 font-mono">
                    <div>Student: ____________________</div>
                    <div className="mt-1">Date: ____________________</div>
                  </div>
                </div>
              </div>

              {/* Rubric Matrix Table */}
              <div className="space-y-6">
                {(rubric.ismg_criteria || []).map((crit, cIdx) => (
                  <div key={cIdx} className="border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 dark:bg-zinc-800 px-4 py-2.5 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">
                        Criterion {cIdx + 1}: {crit.criterion_name}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">Criteria Weight: 100%</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-zinc-700 bg-white dark:bg-zinc-900 text-xs">
                      {(crit.performance_levels || []).map((lvl, lIdx) => (
                        <div key={lIdx} className="p-3 sm:p-3.5 flex flex-col justify-between">
                          <div>
                            <div className="font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-1.5 flex items-center justify-between">
                              <span>Level {crit.performance_levels.length - lIdx}</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-[10px]">
                                {lvl.mark_range}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                              {lvl.description}
                            </p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                            <span>Teacher Score:</span>
                            <span>[   ]</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* LMS Export Action */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center print:hidden">
                <span className="text-xs text-slate-500">Ready to distribute rubric to your LMS?</span>
                <LMSExportButton
                  contentHtml={`<h2>${rubric.assessment_title}</h2><p>Criteria Count: ${rubric.ismg_criteria?.length}</p>`}
                />
              </div>
            </div>
          ) : (
            <div className="card shadow-lg border border-dashed border-slate-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[360px]">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Award size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Ready to Generate Rubric</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                Enter your assessment topic on the left to synthesize criterion-referenced performance bands with QCAA cognitive verbs.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RubricGeneratorPage;
