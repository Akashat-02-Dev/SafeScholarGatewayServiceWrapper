import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../services/authService';
import { aiService } from '../../services/aiService';
import { 
  assessmentAssignmentService, 
  type AssignedAssessment, 
  type StudentTestSubmission,
  formatDeadlineRemaining,
  normalizeYearLevel,
  AUSTRALIAN_YEAR_LEVELS
} from '../../services/assessmentAssignmentService';
import type { AssessmentSchema } from '../../types/aios';
import { 
  ClipboardCheck, Sparkles, Printer, Calendar, 
  Clock, Layers, AlertCircle, Loader2,
  Send, Users, CheckCircle2, ExternalLink, RefreshCw,
  Zap, Eye, X, Check, Award
} from 'lucide-react';
import { Link } from 'react-router-dom';

const YEAR_LEVELS = [
  'Prep / Foundation',
  'Year 1',
  'Year 2',
  'Year 3 (NAPLAN Aligned)',
  'Year 4',
  'Year 5 (NAPLAN Aligned)'
];

const ASSESSMENT_TYPES = [
  'Formative Checkpoint Quiz',
  'Summative Unit Assessment',
  'NAPLAN Practice Test (Literacy/Numeracy)',
  'Diagnostic Pre-Assessment'
];

export const AssessmentGeneratorPage: React.FC = () => {
  const { me } = useAuth();
  const institutionId = me?.institutionId || 'default-inst';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'generator' | 'assignments'>('generator');

  // Generator Form State
  const [gradeLevel, setGradeLevel] = useState('Year 3 (NAPLAN Aligned)');
  const [subject, setSubject] = useState('Mathematics');
  const [assessmentType, setAssessmentType] = useState('Formative Checkpoint Quiz');
  const [questionCount, setQuestionCount] = useState(4);
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');

  // Declared Deadline State ('immediate' finishes within 1 hour based on question count)
  const [deadlinePreset, setDeadlinePreset] = useState<'immediate' | '24h' | '48h' | '72h' | '7d' | 'custom'>('48h');
  const [customDeadline, setCustomDeadline] = useState(() => {
    const d = new Date(Date.now() + 48 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [publishedTest, setPublishedTest] = useState<AssignedAssessment | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Submissions & Assigned Tests View State
  const [assignedTests, setAssignedTests] = useState<AssignedAssessment[]>([]);
  const [selectedTestForSubs, setSelectedTestForSubs] = useState<AssignedAssessment | null>(null);
  const [submissionsList, setSubmissionsList] = useState<StudentTestSubmission[]>([]);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [viewingSubmission, setViewingSubmission] = useState<StudentTestSubmission | null>(null);

  useEffect(() => {
    loadAssignedTests();
    const handler = () => loadAssignedTests();
    window.addEventListener('safescholar_assigned_tests_updated', handler);
    window.addEventListener('safescholar_submissions_updated', handler);
    return () => {
      window.removeEventListener('safescholar_assigned_tests_updated', handler);
      window.removeEventListener('safescholar_submissions_updated', handler);
    };
  }, []);

  const loadAssignedTests = () => {
    const tests = assessmentAssignmentService.getAssignedAssessments();
    setAssignedTests(tests);
    if (selectedTestForSubs) {
      const subs = assessmentAssignmentService.getSubmissionsForAssessment(selectedTestForSubs.id);
      setSubmissionsList(subs);
    }
  };

  // Immediate start: calculated to be attempted and finished within an hour (max 60m, min 15m) based on question count
  const getImmediateDurationMinutes = (count: number) => {
    return Math.min(60, Math.max(15, count * 5));
  };

  const calculateDeadlineISO = (): string => {
    if (deadlinePreset === 'immediate') {
      const mins = getImmediateDurationMinutes(questionCount);
      return new Date(Date.now() + mins * 60 * 1000).toISOString();
    }
    if (deadlinePreset === '24h') return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    if (deadlinePreset === '48h') return new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    if (deadlinePreset === '72h') return new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    if (deadlinePreset === '7d') return new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    return new Date(customDeadline).toISOString();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError(null);
    setAssessment(null);
    setPublishedTest(null);
    setPublishSuccess(false);

    try {
      const res = await aiService.generateAssessment(
        institutionId,
        gradeLevel,
        subject,
        assessmentType,
        questionCount,
        topic,
        details || 'Australian Curriculum Prep to Year 5 assessment'
      );
      setAssessment(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate assessment. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishToClass = () => {
    if (!assessment) return;

    const deadlineISO = calculateDeadlineISO();
    const teacherName = me?.firstName ? `${me.firstName} ${me.lastName || ''}`.trim() : 'Classroom Teacher';
    const teacherEmail = me?.email || 'teacher@safescholar.edu.au';
    const isImmediate = deadlinePreset === 'immediate';
    const qCount = assessment.questions?.length || questionCount;
    const immediateMins = isImmediate ? getImmediateDurationMinutes(qCount) : undefined;

    const published = assessmentAssignmentService.publishAssessment(assessment, {
      gradeLevel,
      subject,
      assessmentType,
      deadline: deadlineISO,
      teacherName,
      teacherEmail,
      isImmediateStart: isImmediate,
      timeLimitMinutes: immediateMins
    });

    setPublishedTest(published);
    setPublishSuccess(true);
    loadAssignedTests();
    setTimeout(() => setPublishSuccess(false), 4000);
  };

  const handleSelectTestToViewSubs = (test: AssignedAssessment) => {
    setSelectedTestForSubs(test);
    const subs = assessmentAssignmentService.getSubmissionsForAssessment(test.id);
    setSubmissionsList(subs);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredAssignedTests = assignedTests.filter((t) => {
    if (filterYear === 'all') return true;
    return normalizeYearLevel(t.gradeLevel) === filterYear;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      {/* Header Banner */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden mb-6 print:hidden">
        <div className="cardInner p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 shrink-0">
                <ClipboardCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Assessment & Quiz Generator</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wide">
                    2-Way Class Connected
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Design assessments for Prep to Year 5, declare deadlines, and assign directly to enrolled student rosters.
                </p>
              </div>
            </div>

            {/* Tab Navigation Pill */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl border border-slate-200 dark:border-zinc-700 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('generator')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'generator'
                    ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Sparkles size={14} />
                <span>AI Generator</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assignments')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'assignments'
                    ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Users size={14} />
                <span>Class Assignments ({assignedTests.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: AI GENERATOR & PUBLISH TO CLASS                  */}
      {/* ======================================================== */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form */}
          <div className="lg:col-span-5 print:hidden">
            <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers size={16} className="text-indigo-500" /> Assessment Configuration
              </h3>

              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Australian Grade Band</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {YEAR_LEVELS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Assessment Instrument Type</label>
                  <select
                    value={assessmentType}
                    onChange={(e) => setAssessmentType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Subject Area</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Mathematics"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Question Count</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Topic & ACARA Target Focus</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Fractions on a Number Line (AC9M3N01)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Declared Deadline Selector */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                      <Calendar size={14} className="text-indigo-600" /> Declared Student Submission Deadline
                    </label>
                    {deadlinePreset === 'immediate' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                        <Zap size={10} className="fill-amber-500" /> Immediate Start
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-2.5">
                    {(['immediate', '24h', '48h', '72h', '7d'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDeadlinePreset(preset)}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
                          deadlinePreset === preset
                            ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                            : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50'
                        }`}
                      >
                        {preset === 'immediate' ? (
                          <>
                            <Zap size={11} className={deadlinePreset === 'immediate' ? 'text-amber-300' : 'text-amber-500'} />
                            <span>Immediate</span>
                          </>
                        ) : preset === '24h' ? (
                          '24 Hours'
                        ) : preset === '48h' ? (
                          '2 Days'
                        ) : preset === '72h' ? (
                          '3 Days'
                        ) : (
                          '1 Week'
                        )}
                      </button>
                    ))}
                  </div>

                  {deadlinePreset === 'immediate' ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <Zap size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">⚡ Immediate Start ({getImmediateDurationMinutes(questionCount)}m Window)</div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                          Automatically configured to be attempted and finished within 1 hour based on {questionCount} questions ({getImmediateDurationMinutes(questionCount)} mins).
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={customDeadline}
                        onChange={(e) => {
                          setCustomDeadline(e.target.value);
                          setDeadlinePreset('custom');
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  )}

                  <div className="text-[10px] text-indigo-700 dark:text-indigo-400 mt-1.5">
                    Only students in <strong>{normalizeYearLevel(gradeLevel)}</strong> can attempt this test before this deadline.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Pedagogical Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="e.g. Include Australian real-world word problems and step-by-step reasoning."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isGenerating || !topic.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Synthesizing ACARA Assessment...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Generate Assessment & Quiz</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Preview Column */}
          <div className="lg:col-span-7 print:col-span-12">
            {assessment ? (
              <div className="card shadow-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 print:p-0 print:border-none print:shadow-none space-y-6">
                
                {/* Publish Success Banner */}
                {publishSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={20} className="text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold">Successfully Published to {normalizeYearLevel(gradeLevel)}!</div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          Students in {normalizeYearLevel(gradeLevel)} can now attempt this test in their Test Environment before the deadline.
                        </div>
                      </div>
                    </div>
                    <Link
                      to="/student/test-environment"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shrink-0 flex items-center gap-1"
                    >
                      <span>Open Test View</span>
                      <ExternalLink size={12} />
                    </Link>
                  </motion.div>
                )}

                {/* Exam Header */}
                <div className="border-b-2 border-slate-800 dark:border-slate-300 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{assessment.test_title}</h1>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold flex items-center gap-3">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{normalizeYearLevel(gradeLevel)}</span>
                        <span>•</span>
                        <span>{subject}</span>
                        <span>•</span>
                        <span>{assessmentType}</span>
                        <span>•</span>
                        <span className="text-amber-600">{assessment.aligned_standards?.join(', ')}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 font-mono">
                      <div>Time Limit: {assessment.time_limit_minutes || 20} mins</div>
                      <div className="mt-1 font-bold text-slate-800 dark:text-slate-200">Total Marks: {assessment.total_marks || (assessment.questions?.length * 2)}</div>
                    </div>
                  </div>

                  {assessment.instructions && (
                    <div className="mt-4 p-3 bg-blue-50/70 dark:bg-zinc-800/60 border border-blue-200/60 dark:border-zinc-700 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                      <strong>Instructions: </strong>{assessment.instructions}
                    </div>
                  )}
                </div>

                {/* Interactive Publishing Actions Bar */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-zinc-800/80 dark:to-zinc-800/80 border border-blue-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                        Target Class: {normalizeYearLevel(gradeLevel)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200">
                        {deadlinePreset === '24h' ? 'Due in 24h' : deadlinePreset === '48h' ? 'Due in 2 days' : 'Custom Deadline'}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-700 dark:text-zinc-400 mt-0.5">
                      Submissions lock automatically when the declared deadline passes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePublishToClass}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      <Send size={14} />
                      <span>{publishedTest ? 'Re-Publish to Class' : `Assign to ${normalizeYearLevel(gradeLevel)}`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAnswerKey(!showAnswerKey)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    >
                      {showAnswerKey ? 'Hide Answers' : 'Answers'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                </div>

                {/* Questions Preview */}
                <div className="space-y-4">
                  {(assessment.questions || []).map((q, idx) => (
                    <div key={q.id || idx} className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/40">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">Question {q.number || idx + 1}</span>
                        <div className="flex items-center gap-2">
                          {q.cognitive_verb && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase">
                              {q.cognitive_verb}
                            </span>
                          )}
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">[{q.marks || 2} Marks]</span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mb-3 font-medium whitespace-pre-wrap">{q.question_text}</p>

                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {showAnswerKey && (
                        <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                          <div className="font-bold">✓ Correct Answer: {q.correct_answer}</div>
                          {q.explanation && (
                            <div className="text-[11px] mt-1 text-emerald-700 dark:text-emerald-400">
                              <strong>Marking Notes:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card shadow-lg border border-dashed border-slate-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[360px]">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                  <ClipboardCheck size={26} />
                </div>
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Ready to Generate Assessment</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  Configure your assessment type, grade level, and declared deadline on the left to design a rigorous test with marking schemes.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CLASS ASSIGNMENTS & LIVE STUDENT SUBMISSIONS     */}
      {/* ======================================================== */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Active Class Assignments & Submissions</h3>
                <p className="text-xs text-slate-500 mt-0.5">Two-way connection: Every student of the respective year attempts their assigned test within the deadline.</p>
              </div>

              {/* Year Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Filter Year:</span>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  <option value="all">All Year Levels</option>
                  {AUSTRALIAN_YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadAssignedTests}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 hover:bg-slate-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* Assignments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssignedTests.map((test) => {
                const deadlineInfo = formatDeadlineRemaining(test.deadline);
                const subs = assessmentAssignmentService.getSubmissionsForAssessment(test.id);
                const isSelected = selectedTestForSubs?.id === test.id;

                return (
                  <div
                    key={test.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {test.gradeLevel}
                        </span>
                        {test.isImmediateStart && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                            <Zap size={10} className="fill-amber-500 text-amber-500" /> Immediate Start
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${deadlineInfo.badgeColor}`}>
                        {deadlineInfo.text}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{test.title}</h4>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{test.subject}</span>
                      <span>•</span>
                      <span>{test.questions?.length || 0} Questions</span>
                      {test.isImmediateStart && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold">{test.timeLimitMinutes || 20}m Window</span>
                        </>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-700/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Users size={14} className="text-blue-600" />
                        <span className="font-bold">{subs.length} Submissions</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectTestToViewSubs(test)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {isSelected ? 'Viewing Submissions' : 'View Submissions'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submissions Detail Table Drawer */}
          {selectedTestForSubs && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card shadow-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-7 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700">
                      {selectedTestForSubs.gradeLevel}
                    </span>
                    {selectedTestForSubs.isImmediateStart && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Zap size={10} className="fill-amber-500" /> Immediate Start ({selectedTestForSubs.timeLimitMinutes}m Window)
                      </span>
                    )}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Student Results: {selectedTestForSubs.title}
                    </h3>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Deadline: {new Date(selectedTestForSubs.deadline).toLocaleString('en-AU')} • Total Marks: {selectedTestForSubs.totalMarks} • Time Limit: {selectedTestForSubs.timeLimitMinutes || 20} mins
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Total Completed: {submissionsList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTestForSubs(null);
                      setViewingSubmission(null);
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Class Summary KPIs if submissions exist */}
              {submissionsList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">Submissions</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{submissionsList.length}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Attempted once</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/40">
                    <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">Class Average</div>
                    <div className="text-xl font-black text-indigo-950 dark:text-indigo-100 mt-0.5">
                      {Math.round(submissionsList.reduce((acc, s) => acc + s.percentage, 0) / submissionsList.length)}%
                    </div>
                    <div className="text-[10px] text-indigo-600/70 dark:text-indigo-400 mt-0.5">Mean performance</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40">
                    <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Highest Score</div>
                    <div className="text-xl font-black text-emerald-950 dark:text-emerald-100 mt-0.5">
                      {Math.max(...submissionsList.map(s => s.percentage))}%
                    </div>
                    <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400 mt-0.5">Top result</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40">
                    <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase">Pass Rate (≥50%)</div>
                    <div className="text-xl font-black text-blue-950 dark:text-blue-100 mt-0.5">
                      {Math.round((submissionsList.filter(s => s.percentage >= 50).length / submissionsList.length) * 100)}%
                    </div>
                    <div className="text-[10px] text-blue-600/70 dark:text-blue-400 mt-0.5">Meets standards</div>
                  </div>
                </div>
              )}

              {submissionsList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-semibold uppercase text-[10px]">
                        <th className="pb-2.5">Student Name</th>
                        <th className="pb-2.5">Enrolled Class</th>
                        <th className="pb-2.5">Submitted At</th>
                        <th className="pb-2.5">Score / Marks</th>
                        <th className="pb-2.5">Percentage</th>
                        <th className="pb-2.5">Australian Grade Band</th>
                        <th className="pb-2.5 text-right">Student Responses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {submissionsList.map((sub) => (
                        <tr key={sub.id} className="text-slate-800 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="py-3 font-bold flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-[10px]">
                              {sub.studentName.charAt(0)}
                            </div>
                            <div>
                              <div>{sub.studentName}</div>
                              <div className="text-[10px] text-slate-400">{sub.studentEmail}</div>
                            </div>
                          </td>
                          <td className="py-3 font-semibold text-slate-600 dark:text-slate-400">{sub.studentYearLevel}</td>
                          <td className="py-3 text-slate-500">{new Date(sub.submittedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} ({new Date(sub.submittedAt).toLocaleDateString('en-AU')})</td>
                          <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{sub.earnedMarks} / {sub.totalMarks}</td>
                          <td className="py-3 font-bold">{sub.percentage}%</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              sub.gradeBand === 'A' ? 'bg-emerald-100 text-emerald-700' :
                              sub.gradeBand === 'B' ? 'bg-blue-100 text-blue-700' :
                              sub.gradeBand === 'C' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              Grade {sub.gradeBand}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setViewingSubmission(sub)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-colors shadow-sm"
                            >
                              <Eye size={13} />
                              <span>View Responses</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <Clock size={24} className="mx-auto mb-2 text-slate-400" />
                  No students in {selectedTestForSubs.gradeLevel} have submitted this test yet.
                  <div className="text-[11px] text-slate-400 mt-1">Students can attempt this test once from the Student Test Environment before {new Date(selectedTestForSubs.deadline).toLocaleString('en-AU')}.</div>
                </div>
              )}

              {/* Student Response Audit Modal / Review Panel */}
              {viewingSubmission && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-5 sm:p-6 rounded-2xl bg-slate-50/90 dark:bg-zinc-800/90 border border-indigo-200 dark:border-zinc-700 shadow-inner space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow">
                        {viewingSubmission.studentName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">
                            {viewingSubmission.studentName}'s Test Responses
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700">
                            {viewingSubmission.studentYearLevel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Submitted: {new Date(viewingSubmission.submittedAt).toLocaleString('en-AU')} • Duration: {Math.floor(viewingSubmission.timeSpentSeconds / 60)}m {viewingSubmission.timeSpentSeconds % 60}s
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-sm">
                        <Award size={16} className="text-indigo-600" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Score: <strong className="text-indigo-600 font-mono text-sm">{viewingSubmission.earnedMarks}/{viewingSubmission.totalMarks}</strong> ({viewingSubmission.percentage}%)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                          Grade {viewingSubmission.gradeBand}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setViewingSubmission(null)}
                        className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-slate-300 transition-colors"
                        title="Close Inspector"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Question Responses Breakdown */}
                  <div className="space-y-3 pt-1">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Question-by-Question Response Audit
                    </div>

                    {(selectedTestForSubs.questions || []).map((q, idx) => {
                      const studentAns = viewingSubmission.answers[q.number];
                      const isCorrect = studentAns && studentAns.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
                      const awardedMarks = isCorrect ? (q.marks || 2) : 0;

                      return (
                        <div
                          key={q.id || idx}
                          className={`p-4 rounded-xl border transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-800/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] shrink-0 font-bold">
                                {q.number}
                              </span>
                              <span>{q.question_text}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCorrect ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300">
                                  <Check size={12} /> Correct (+{awardedMarks}m)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 border border-red-300">
                                  <X size={12} /> Incorrect (0/{q.marks || 2}m)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-3 pt-2.5 border-t border-slate-200/60 dark:border-zinc-700/60">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Student's Submitted Answer:</span>
                              <div className={`p-2 rounded-lg font-medium text-xs ${
                                isCorrect 
                                  ? 'bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' 
                                  : 'bg-red-100/70 text-red-900 dark:bg-red-900/40 dark:text-red-200 line-through'
                              }`}>
                                {studentAns || '(No Answer Submitted)'}
                              </div>
                            </div>

                            {!isCorrect && (
                              <div>
                                <span className="text-[10px] font-bold text-emerald-600 block mb-0.5">Official Correct Answer:</span>
                                <div className="p-2 rounded-lg font-bold text-xs bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                                  {q.correct_answer}
                                </div>
                              </div>
                            )}
                          </div>

                          {q.explanation && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 pt-2 border-t border-slate-200/40 dark:border-zinc-700/40">
                              <strong>Marking Rationale:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AssessmentGeneratorPage;
