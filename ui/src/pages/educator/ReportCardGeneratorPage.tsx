import React, { useState, useEffect } from 'react';
import { 
  BookOpen, AlertCircle, FileText, Award, 
  RefreshCw, Search, ArrowRight, Sparkles, 
  Check, Copy
} from 'lucide-react';
import { LMSExportButton } from '../../components/LMSExportButton';
import { useAuth } from '../../services/authService';
import { 
  assessmentAssignmentService, 
  type StudentTestSubmission,
  AUSTRALIAN_YEAR_LEVELS,
  normalizeYearLevel
} from '../../services/assessmentAssignmentService';

interface ReportCardResult {
  student_name: string;
  grade_assigned: string;
  report_comment: string;
}

export default function ReportCardGeneratorPage() {
  const { tokens, me } = useAuth();

  // Navigation tab for Institute Management: Generator vs Full Results Registry
  const [activeTab, setActiveTab] = useState<'generator' | 'registry'>('generator');

  // Submissions data from Student Test Environment
  const [submissions, setSubmissions] = useState<StudentTestSubmission[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [registryFilterYear, setRegistryFilterYear] = useState<string>('all');
  const [registrySearch, setRegistrySearch] = useState<string>('');

  // Form State
  const [studentName, setStudentName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('C');
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ReportCardResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Load all recorded submissions from shared store
  const loadSubmissions = () => {
    const list = assessmentAssignmentService.getAllSubmissions();
    setSubmissions(list);
  };

  useEffect(() => {
    loadSubmissions();
    const handleSubsUpdated = () => loadSubmissions();
    window.addEventListener('safescholar_submissions_updated', handleSubsUpdated);
    return () => {
      window.removeEventListener('safescholar_submissions_updated', handleSubsUpdated);
    };
  }, []);

  // When a student's quiz/assessment submission is selected, auto-populate the report card form
  const handleSelectSubmission = (subId: string) => {
    setSelectedSubId(subId);
    if (!subId) return;

    const sub = submissions.find(s => s.id === subId);
    if (!sub) return;

    setStudentName(sub.studentName);
    setSubject(`${sub.studentYearLevel} ${sub.assessmentTitle.split(':')[0] || 'Mathematics'}`);
    setGrade(sub.gradeBand || 'C');
    
    const minutesTaken = Math.max(1, Math.round(sub.timeSpentSeconds / 60));
    const evidenceText = `Official Curriculum Benchmark Evidence: Student completed "${sub.assessmentTitle}" on ${new Date(sub.submittedAt).toLocaleDateString('en-AU')}. Achieved a validated score of ${sub.earnedMarks}/${sub.totalMarks} (${sub.percentage}% - Grade Band ${sub.gradeBand}) with a focused completion time of ${minutesTaken} minutes. Demonstrated solid understanding of syllabus descriptors for ${sub.studentYearLevel}.`;
    
    setNotes(evidenceText);
    setError('');
  };

  // Jump from registry table directly to report card generator for that student
  const handleSelectFromRegistry = (sub: StudentTestSubmission) => {
    handleSelectSubmission(sub.id);
    setActiveTab('generator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        throw new Error('User is not authenticated. Please log in again.');
      }

      const response = await fetch('/api/v1/ai/educator/report-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          tool_id: 'report_card_generator',
          institution_id: me?.institutionId || '',
          parameters: {
            student_name: studentName,
            subject: subject,
            grade_assigned: grade,
            user_prompt: notes + ' (Aligned to Australian Curriculum from Prep to Year 5)'
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || 'Failed to generate report card comment');
      }

      const data = await response.json();
      const parsedContent = typeof data.response_text === 'string' ? JSON.parse(data.response_text) : data.response_text;
      setResult(parsedContent);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateHtml = () => {
    if (!result) return "";
    return `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Official Academic Report Card: ${result.student_name}</h2>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Australian Curriculum Grade Band:</strong> ${result.grade_assigned}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #334155; line-height: 1.6;">${result.report_comment}</p>
      </div>
    `;
  };

  const handleCopy = () => {
    if (!result?.report_comment) return;
    navigator.clipboard.writeText(result.report_comment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedSub = submissions.find(s => s.id === selectedSubId);

  // Registry filter
  const filteredSubmissions = submissions.filter(s => {
    const matchesYear = registryFilterYear === 'all' || normalizeYearLevel(s.studentYearLevel) === registryFilterYear;
    const matchesSearch = 
      s.studentName.toLowerCase().includes(registrySearch.toLowerCase()) ||
      s.studentEmail.toLowerCase().includes(registrySearch.toLowerCase()) ||
      s.assessmentTitle.toLowerCase().includes(registrySearch.toLowerCase());
    return matchesYear && matchesSearch;
  });

  return (
    <div className="page w-full space-y-6">
      {/* Page Title & Navigation Header */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/20 shrink-0">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Institute Report Card & Assessment Registry
                </h1>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Institute Mgmt Console
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Access official student quiz and assessment score reports to generate Australian Curriculum A–E graded report card statements.
              </p>
            </div>
          </div>

          {/* Toggle between Generator and Results Registry */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl border border-slate-200 dark:border-zinc-700 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('generator')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'generator'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText size={14} />
              <span>Report Card Generator</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('registry')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'registry'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Award size={14} />
              <span>Assessment Results Registry ({submissions.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: REPORT CARD GENERATOR WITH BENCHMARK EVIDENCE      */}
      {/* ========================================================= */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input Form with Assessment Import */}
          <div className="lg:col-span-7">
            <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 space-y-5">
              
              {/* Import from Official Assessment Submissions */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                    <Award size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Import Student Assessment Result (Two-Way Registry)</span>
                  </label>
                  <button
                    type="button"
                    onClick={loadSubmissions}
                    className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-[11px] font-semibold flex items-center gap-1"
                    title="Reload latest quiz attempts"
                  >
                    <RefreshCw size={12} />
                    <span>Sync</span>
                  </button>
                </div>

                <select
                  value={selectedSubId}
                  onChange={(e) => handleSelectSubmission(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose an attempted quiz/assessment result to auto-populate --</option>
                  {submissions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentName} ({s.studentYearLevel}) — {s.assessmentTitle.slice(0, 40)}... [Score: {s.earnedMarks}/{s.totalMarks} ({s.percentage}%) - Grade {s.gradeBand}]
                    </option>
                  ))}
                </select>

                {selectedSub && (
                  <div className="p-3 rounded-xl bg-white/90 dark:bg-zinc-800/90 border border-emerald-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{selectedSub.studentName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 text-[10px]">{selectedSub.studentYearLevel}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Test: {selectedSub.assessmentTitle}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {selectedSub.earnedMarks} / {selectedSub.totalMarks} ({selectedSub.percentage}%)
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                        selectedSub.gradeBand === 'A' ? 'bg-emerald-100 text-emerald-800' :
                        selectedSub.gradeBand === 'B' ? 'bg-blue-100 text-blue-800' :
                        selectedSub.gradeBand === 'C' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Grade {selectedSub.gradeBand}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Core Generation Form */}
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Student Name
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="e.g. Alex Johnson"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Subject / Discipline Area
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      placeholder="e.g. Year 3 Mathematics (Numeracy)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Demonstrated Australian Grade Band (A–E)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="A">Grade A — Very High Achievement (Exemplary standards)</option>
                    <option value="B">Grade B — High Achievement (Thorough understanding)</option>
                    <option value="C">Grade C — Sound Achievement (Competent grasp of core concepts)</option>
                    <option value="D">Grade D — Limited Achievement (Developing foundational skills)</option>
                    <option value="E">Grade E — Emerging Achievement (Requires targeted support)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Academic Benchmark Evidence & Pedagogical Notes
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none leading-relaxed"
                    placeholder="Auto-populated from student's test results, or add customized qualitative teacher observations..."
                  />
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isGenerating || !studentName.trim() || !notes.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Synthesizing ACARA Report Comment...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Generate Official Academic Report Card</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Output Card */}
          <div className="lg:col-span-5">
            <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 flex flex-col min-h-[480px] justify-between">
              {!result ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-8">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mb-4">
                    <FileText size={28} />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Ready for Synthesis</h3>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Select a student's verified quiz attempt or enter details on the left to generate an Australian Curriculum standard report statement.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Official Report Card</div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{result.student_name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        result.grade_assigned === 'A' ? 'bg-emerald-100 text-emerald-800' :
                        result.grade_assigned === 'B' ? 'bg-blue-100 text-blue-800' :
                        result.grade_assigned === 'C' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Grade {result.grade_assigned}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">
                    <strong>Subject:</strong> {subject}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                      Synthesized Pastoral & Academic Statement
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                      {result.report_comment}
                    </div>
                  </div>

                  {/* Actions: Copy & LMS Export */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied to Clipboard' : 'Copy Statement'}</span>
                    </button>
                    <div className="flex-1">
                      <LMSExportButton contentHtml={generateHtml()} courseId="Australian-Curriculum-Prep-Year5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: INSTITUTE QUIZ & ASSESSMENT SCORE REGISTRY         */}
      {/* ========================================================= */}
      {activeTab === 'registry' && (
        <div className="space-y-6">
          {/* Metrics Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="card p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-slate-500 text-[11px] font-bold uppercase">Completed Tests</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{submissions.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Attempted once per student</div>
            </div>

            <div className="card p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-indigo-600 dark:text-indigo-400 text-[11px] font-bold uppercase">Institute Mean Score</div>
              <div className="text-2xl font-black text-indigo-950 dark:text-indigo-100 mt-1">
                {submissions.length ? Math.round(submissions.reduce((acc, s) => acc + s.percentage, 0) / submissions.length) : 0}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across all enrolled years</div>
            </div>

            <div className="card p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase">Top Achievers (A/B)</div>
              <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
                {submissions.filter(s => s.gradeBand === 'A' || s.gradeBand === 'B').length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">High proficiency grades</div>
            </div>

            <div className="card p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-blue-600 dark:text-blue-400 text-[11px] font-bold uppercase">Target Grades</div>
              <div className="text-2xl font-black text-blue-950 dark:text-blue-100 mt-1">Prep - Year 5</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Australian Curriculum</div>
            </div>
          </div>

          {/* Results Table Card */}
          <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Official Assessment & Quiz Results Roster
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct student attempt records accessible to Institute Management. Click "Generate Report Card" on any record to synthesize an official statement.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative min-w-[180px]">
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={registrySearch}
                    onChange={(e) => setRegistrySearch(e.target.value)}
                    placeholder="Search student or quiz..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={registryFilterYear}
                  onChange={(e) => setRegistryFilterYear(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  <option value="all">All Year Levels</option>
                  {AUSTRALIAN_YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadSubmissions}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-600 hover:bg-slate-100"
                  title="Refresh Roster"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* Table */}
            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                No matching student quiz results found in the registry.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="pb-3 font-semibold">Student Name & Email</th>
                      <th className="pb-3 font-semibold">Year Level</th>
                      <th className="pb-3 font-semibold">Assessment / Quiz Title</th>
                      <th className="pb-3 font-semibold text-center">Score / Marks</th>
                      <th className="pb-3 font-semibold text-center">Percentage</th>
                      <th className="pb-3 font-semibold text-center">Grade Band</th>
                      <th className="pb-3 font-semibold">Submitted Date</th>
                      <th className="pb-3 font-semibold text-right">Institute Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="text-slate-800 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="py-3 font-bold flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs">
                            {sub.studentName.charAt(0)}
                          </div>
                          <div>
                            <div>{sub.studentName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{sub.studentEmail}</div>
                          </div>
                        </td>
                        <td className="py-3 font-bold text-slate-700 dark:text-slate-300">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {sub.studentYearLevel}
                          </span>
                        </td>
                        <td className="py-3 font-medium max-w-[280px] truncate" title={sub.assessmentTitle}>
                          {sub.assessmentTitle}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {sub.earnedMarks} / {sub.totalMarks}
                        </td>
                        <td className="py-3 text-center font-bold">
                          {sub.percentage}%
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            sub.gradeBand === 'A' ? 'bg-emerald-100 text-emerald-800' :
                            sub.gradeBand === 'B' ? 'bg-blue-100 text-blue-800' :
                            sub.gradeBand === 'C' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            Grade {sub.gradeBand}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 text-[11px]">
                          {new Date(sub.submittedAt).toLocaleDateString('en-AU')} {new Date(sub.submittedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectFromRegistry(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                          >
                            <span>Generate Report Card</span>
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
