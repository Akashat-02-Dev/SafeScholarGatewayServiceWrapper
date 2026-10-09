import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../services/authService';
import { 
  assessmentAssignmentService, 
  type AssignedAssessment, 
  type StudentTestSubmission, 
  type AustralianYearLevel,
  AUSTRALIAN_YEAR_LEVELS,
  normalizeYearLevel,
  isDeadlineExpired,
  formatDeadlineRemaining
} from '../../services/assessmentAssignmentService';
import { 
  ClipboardCheck, Clock, CheckCircle2, Lock, 
  Trophy, HelpCircle, Check, X, ArrowRight, ArrowLeft, 
  RefreshCw, GraduationCap, BookOpen, 
  AlertCircle, ChevronRight, RotateCcw, Zap
} from 'lucide-react';

export const StudentTestEnvironmentPage: React.FC = () => {
  const { me } = useAuth();

  // Enrolled Year Level State (Prep to Year 5)
  const [enrolledYear, setEnrolledYear] = useState<AustralianYearLevel>(() => {
    return assessmentAssignmentService.getEnrolledYearLevel();
  });

  // Roster of all assigned tests from teachers
  const [assignedTests, setAssignedTests] = useState<AssignedAssessment[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<StudentTestSubmission[]>([]);

  // View state: 'roster' (select test) | 'testing' (in test) | 'results' (review test)
  const [viewState, setViewState] = useState<'roster' | 'testing' | 'results'>('roster');

  // Currently active assessment
  const [activeTest, setActiveTest] = useState<AssignedAssessment | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [testStartTime, setTestStartTime] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15 * 60);

  // Latest completed submission result
  const [latestSubmission, setLatestSubmission] = useState<StudentTestSubmission | null>(null);

  // Filter tab on roster view: 'enrolled' (my class only) | 'all' (all grades)
  const [rosterFilter, setRosterFilter] = useState<'enrolled' | 'all'>('enrolled');

  // Access restriction alert modal or message
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  // Student identification string
  const studentEmail = me?.email || 'student@safescholar.edu.au';
  const studentName = me?.firstName ? `${me.firstName} ${me.lastName || ''}`.trim() : (me?.email?.split('@')[0] || 'Student');
  const studentId = me?.userId || 'student-portal';

  // Load tests and submissions
  const refreshData = () => {
    const allTests = assessmentAssignmentService.getAssignedAssessments();
    setAssignedTests(allTests);
    const mySubs = assessmentAssignmentService.getStudentSubmissions(studentEmail);
    setStudentSubmissions(mySubs);
  };

  useEffect(() => {
    refreshData();

    const handleTestsUpdated = () => refreshData();
    const handleSubsUpdated = () => refreshData();
    const handleYearUpdated = () => {
      setEnrolledYear(assessmentAssignmentService.getEnrolledYearLevel());
      refreshData();
    };

    window.addEventListener('safescholar_assigned_tests_updated', handleTestsUpdated);
    window.addEventListener('safescholar_submissions_updated', handleSubsUpdated);
    window.addEventListener('safescholar_student_year_updated', handleYearUpdated);

    return () => {
      window.removeEventListener('safescholar_assigned_tests_updated', handleTestsUpdated);
      window.removeEventListener('safescholar_submissions_updated', handleSubsUpdated);
      window.removeEventListener('safescholar_student_year_updated', handleYearUpdated);
    };
  }, [studentEmail]);

  // Handle year level switch (enables testing Prep to Year 5 access)
  const handleYearLevelChange = (year: AustralianYearLevel) => {
    setEnrolledYear(year);
    assessmentAssignmentService.setEnrolledYearLevel(year);
    setAccessDeniedMessage(null);
  };

  // Timer countdown while taking test
  useEffect(() => {
    if (viewState !== 'testing' || secondsRemaining <= 0) return;

    // Check if test deadline expired while student was testing
    if (activeTest && isDeadlineExpired(activeTest.deadline)) {
      alert('The deadline for this assessment has expired. Your responses are being automatically submitted.');
      handleFinishAndSubmit();
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishAndSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [viewState, secondsRemaining, activeTest]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Attempt to enter test environment with 2-way verification:
  // 1. Respective Year Level verification (Prep to Year 5)
  // 2. Declared Deadline expiration verification
  const handleEnterTest = (test: AssignedAssessment) => {
    setAccessDeniedMessage(null);

    // Rule 1: Year Level Verification
    const normalizedTestGrade = normalizeYearLevel(test.gradeLevel);
    if (normalizedTestGrade !== enrolledYear) {
      setAccessDeniedMessage(
        `Class Access Restriction: This assessment is strictly provisioned for ${normalizedTestGrade}. You are currently registered in ${enrolledYear}. You may only sit assessments for your enrolled year level.`
      );
      return;
    }

    // Rule 2: Single Attempt Enforcement (Assessment can only be attempted once)
    const existingSubmission = assessmentAssignmentService.getSubmissionForStudentAndTest(studentEmail, test.id);
    if (existingSubmission) {
      setAccessDeniedMessage(
        `Single Attempt Policy: You have already completed your attempt for "${test.title}" on ${new Date(existingSubmission.submittedAt).toLocaleDateString()} at ${new Date(existingSubmission.submittedAt).toLocaleTimeString()} with a score of ${existingSubmission.earnedMarks}/${existingSubmission.totalMarks} (${existingSubmission.percentage}% - Grade ${existingSubmission.gradeBand}). As per academic policy, this assessment can only be attempted once within the declared deadline.`
      );
      return;
    }

    // Rule 3: Declared Deadline Verification
    if (isDeadlineExpired(test.deadline)) {
      setAccessDeniedMessage(
        `Submission Window Closed: The deadline declared by your teacher for "${test.title}" expired on ${new Date(test.deadline).toLocaleString()}. New attempts are locked.`
      );
      return;
    }

    // Check if test has questions
    if (!test.questions || test.questions.length === 0) {
      setAccessDeniedMessage('This assessment has no questions configured yet. Please check back with your teacher.');
      return;
    }

    // Initialize test session
    setActiveTest(test);
    setCurrentQIndex(0);
    setAnswers({});
    setTestStartTime(Date.now());
    setSecondsRemaining((test.timeLimitMinutes || 20) * 60);
    setViewState('testing');
  };

  // Handle student selecting or writing an answer
  const handleSelectOption = (qNumber: number, option: string) => {
    if (viewState !== 'testing') return;
    setAnswers((prev) => ({ ...prev, [qNumber]: option }));
  };

  // Australian QCAA / ACARA standard grade band calculator
  const getGradeBand = (pct: number) => {
    if (pct >= 85) return { grade: 'A', label: 'Very High Achievement', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300' };
    if (pct >= 70) return { grade: 'B', label: 'High Achievement', color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-300' };
    if (pct >= 50) return { grade: 'C', label: 'Sound Achievement', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300' };
    if (pct >= 35) return { grade: 'D', label: 'Limited Achievement', color: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border-orange-300' };
    return { grade: 'E', label: 'Emerging Achievement', color: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-300' };
  };

  // Complete & Submit test back to teacher
  const handleFinishAndSubmit = () => {
    if (!activeTest) return;

    let earnedMarks = 0;
    let totalMarks = 0;

    (activeTest.questions || []).forEach((q) => {
      const qMarks = q.marks || 2;
      totalMarks += qMarks;
      const studentAns = answers[q.number];
      if (studentAns && studentAns.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase()) {
        earnedMarks += qMarks;
      }
    });

    const pct = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const band = getGradeBand(pct);
    const spentSecs = Math.max(1, Math.round((Date.now() - testStartTime) / 1000));

    const submission: StudentTestSubmission = {
      id: `sub-${Date.now()}`,
      assessmentId: activeTest.id,
      assessmentTitle: activeTest.title,
      studentId,
      studentName,
      studentEmail,
      studentYearLevel: enrolledYear,
      submittedAt: new Date().toISOString(),
      earnedMarks,
      totalMarks,
      percentage: pct,
      gradeBand: band.grade,
      answers,
      timeSpentSeconds: spentSecs
    };

    // Save to shared service so teacher sees live in their dashboard
    assessmentAssignmentService.submitTest(submission);
    setLatestSubmission(submission);
    setViewState('results');
    refreshData();
  };

  // Review a previously completed submission
  const handleReviewSubmission = (test: AssignedAssessment) => {
    const existing = studentSubmissions.find((s) => s.assessmentId === test.id);
    if (existing) {
      setActiveTest(test);
      setAnswers(existing.answers || {});
      setLatestSubmission(existing);
      setViewState('results');
    }
  };

  // Filter tests based on tab
  const displayedTests = assignedTests.filter((t) => {
    if (rosterFilter === 'enrolled') {
      return normalizeYearLevel(t.gradeLevel) === enrolledYear;
    }
    return true; // show all
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page max-w-5xl mx-auto">
      {/* ======================================================== */}
      {/* 1. STUDENT IDENTITY & CLASS ENROLMENT TOP BAR            */}
      {/* ======================================================== */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 shrink-0">
              <GraduationCap size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  Student Assessment Environment
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                  2-Way Class Connected
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Logged in as <strong className="text-slate-800 dark:text-slate-200">{studentName}</strong> ({studentEmail})
              </p>
            </div>
          </div>

          {/* Enrolled Year Level Badge & Switcher */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/80 p-2 rounded-2xl border border-slate-200 dark:border-zinc-700/80">
            <div className="text-right pl-2 hidden sm:block">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Enrolled Cohort</div>
              <div className="text-xs font-black text-blue-600 dark:text-blue-400">Australian Curriculum</div>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={enrolledYear}
                onChange={(e) => handleYearLevelChange(e.target.value as AustralianYearLevel)}
                className="px-3 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AUSTRALIAN_YEAR_LEVELS.map((y) => (
                  <option key={y} value={y}>
                    Class: {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Two-way connection info note */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
          <div className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Year Level Gating Active: Only assessments generated by teachers for <strong>{enrolledYear}</strong> can be attempted before their declared deadline.
            </span>
          </div>
          {viewState !== 'roster' && (
            <button
              type="button"
              onClick={() => {
                if (viewState === 'testing') {
                  if (confirm('Are you sure you want to exit the assessment? Your progress will be reset.')) {
                    setViewState('roster');
                  }
                } else {
                  setViewState('roster');
                }
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 self-start sm:self-auto"
            >
              <RotateCcw size={13} />
              <span>Back to Class Tests</span>
            </button>
          )}
        </div>
      </div>

      {/* Access Restriction Notification Banner */}
      <AnimatePresence>
        {accessDeniedMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-3 shadow-sm"
          >
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{accessDeniedMessage}</div>
            <button
              type="button"
              onClick={() => setAccessDeniedMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold text-sm"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 2. ROSTER VIEW: ASSIGNED ASSESSMENTS DIRECTORY           */}
      {/* ======================================================== */}
      {viewState === 'roster' && (
        <div className="space-y-6">
          {/* Subheader & Filter Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ClipboardCheck size={20} className="text-blue-600" />
                Teacher-Assigned Assessments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official curriculum tests created by teachers for your grade.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRosterFilter('enrolled')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  rosterFilter === 'enrolled'
                    ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                My Class ({enrolledYear})
              </button>
              <button
                type="button"
                onClick={() => setRosterFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  rosterFilter === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Year Levels (Prep - Year 5)
              </button>
            </div>
          </div>

          {/* Assessment Cards Grid */}
          {displayedTests.length === 0 ? (
            <div className="card text-center p-12 bg-white/70 dark:bg-zinc-900/70 border border-slate-200 dark:border-white/10 rounded-3xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 mx-auto flex items-center justify-center mb-3">
                <ClipboardCheck size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Assessments Assigned Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Your teacher has not assigned any active assessments for {enrolledYear}. As soon as the teacher generates a test, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {displayedTests.map((t) => {
                const normalizedTestGrade = normalizeYearLevel(t.gradeLevel);
                const isGradeMatch = normalizedTestGrade === enrolledYear;
                const deadlineStatus = formatDeadlineRemaining(t.deadline);
                const isExpired = deadlineStatus.isExpired;
                const pastSubmission = studentSubmissions.find((s) => s.assessmentId === t.id);

                return (
                  <div
                    key={t.id}
                    className={`card rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                      isGradeMatch
                        ? 'bg-white dark:bg-zinc-900/90 border-slate-200/80 dark:border-zinc-800 shadow-md hover:shadow-lg hover:border-blue-300'
                        : 'bg-slate-50/70 dark:bg-zinc-900/40 border-slate-200/50 dark:border-zinc-800/50 opacity-80'
                    }`}
                  >
                    {/* Top Year Level & Deadline Strip */}
                    <div className="p-5 pb-3">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isGradeMatch
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200'
                              : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-300'
                          }`}>
                            {t.gradeLevel}
                          </span>
                          {t.isImmediateStart && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                              <Zap size={10} className="fill-amber-500 text-amber-500" /> Immediate Start
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {t.subject}
                          </span>
                        </div>

                        {/* Deadline Remaining Badge */}
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${deadlineStatus.badgeColor}`}>
                          <Clock size={11} />
                          <span>{deadlineStatus.text}</span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {t.title}
                      </h3>

                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
                        <span>Teacher: <strong className="text-slate-700 dark:text-slate-300">{t.assignedByTeacherName}</strong></span>
                        {t.isImmediateStart && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">{t.timeLimitMinutes || 20}m Finish Window</span>
                          </>
                        )}
                      </div>

                      {/* Standards / Details */}
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          <span>{t.timeLimitMinutes || 20} mins</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <HelpCircle size={12} className="text-slate-400" />
                          <span>{(t.questions || []).length} questions</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <span>{t.totalMarks || 10} marks</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer with Two-Way Gating Enforcement */}
                    <div className="p-4 bg-slate-50/60 dark:bg-zinc-800/40 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                      {/* Status indicator */}
                      <div>
                        {pastSubmission ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 size={14} />
                            <span>Attempted Once: {pastSubmission.earnedMarks}/{pastSubmission.totalMarks} (Grade {pastSubmission.gradeBand})</span>
                          </div>
                        ) : !isGradeMatch ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            <Lock size={12} className="text-slate-400" />
                            <span>Restricted to {normalizedTestGrade}</span>
                          </div>
                        ) : isExpired ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                            <Lock size={12} />
                            <span>Deadline Expired</span>
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            Single Attempt Open
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div>
                        {pastSubmission ? (
                          <button
                            type="button"
                            onClick={() => handleReviewSubmission(t)}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-all"
                          >
                            <span>Review Result</span>
                            <ChevronRight size={13} />
                          </button>
                        ) : !isGradeMatch ? (
                          <button
                            type="button"
                            onClick={() => handleEnterTest(t)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-400 text-xs font-bold flex items-center gap-1 cursor-not-allowed"
                          >
                            <Lock size={12} />
                            <span>Locked</span>
                          </button>
                        ) : isExpired ? (
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1 cursor-not-allowed border border-red-200 dark:border-red-900"
                          >
                            <Lock size={12} />
                            <span>Closed</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEnterTest(t)}
                            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all"
                          >
                            <span>Enter Test</span>
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. TESTING ENVIRONMENT (EXAM TAKING MODE)                */}
      {/* ======================================================== */}
      {viewState === 'testing' && activeTest && (
        <div className="card shadow-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl rounded-3xl overflow-hidden">
          {/* Test Control Topbar */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">
                  Exam Mode • {activeTest.gradeLevel}
                </span>
                <span className="text-[10px] text-slate-400">
                  Teacher: {activeTest.assignedByTeacherName}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">{activeTest.title}</h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Live countdown timer */}
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border font-mono text-xs font-black ${
                secondsRemaining < 120
                  ? 'bg-red-950/80 border-red-600 text-red-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-amber-300'
              }`}>
                <Clock size={14} className={secondsRemaining < 120 ? 'text-red-400' : 'text-amber-400'} />
                <span>{formatTimer(secondsRemaining)}</span>
              </div>

              <div className="text-xs text-slate-300 font-medium hidden md:block">
                Learner: <span className="font-bold text-white">{studentName}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Cancel and exit this test? All unsaved responses will be discarded.')) {
                    setViewState('roster');
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Exit
              </button>
            </div>
          </div>

          {/* Test Body */}
          <div className="p-5 sm:p-8">
            {/* Question Navigator Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 border-b border-slate-200 dark:border-zinc-800 scrollbar-hide">
              {(activeTest.questions || []).map((q, idx) => {
                const isAnswered = Boolean(answers[q.number]);
                const isCurrent = currentQIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentQIndex(idx)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                        : isAnswered
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Current Question */}
            {(() => {
              const currentQ = (activeTest.questions || [])[currentQIndex];
              const totalQ = (activeTest.questions || []).length;
              if (!currentQ) return null;

              return (
                <div className="mb-8">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      Question {currentQIndex + 1} of {totalQ}
                    </span>
                    <div className="flex items-center gap-2">
                      {currentQ.cognitive_verb && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                          {currentQ.cognitive_verb}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-500">
                        [{currentQ.marks || 2} Marks]
                      </span>
                    </div>
                  </div>

                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed mb-6">
                    {currentQ.question_text}
                  </p>

                  {/* Multiple Choice Options */}
                  {currentQ.options && currentQ.options.length > 0 ? (
                    <div className="space-y-3">
                      {currentQ.options.map((opt, oIdx) => {
                        const isSelected = answers[currentQ.number] === opt;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleSelectOption(currentQ.number, opt)}
                            className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition-all flex items-center gap-3.5 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-sm ring-1 ring-blue-500'
                                : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-zinc-600'
                            }`}
                          >
                            <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 text-slate-500'
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      value={answers[currentQ.number] || ''}
                      onChange={(e) => handleSelectOption(currentQ.number, e.target.value)}
                      placeholder="Type your response here..."
                      className="w-full p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  )}
                </div>
              );
            })()}

            {/* Bottom Nav Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-30"
              >
                <ArrowLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-3">
                {currentQIndex < (activeTest.questions || []).length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((prev) => prev + 1)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
                  >
                    <span>Next Question</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishAndSubmit}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg"
                  >
                    <CheckCircle2 size={15} />
                    <span>Finish & Submit Exam</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. RESULTS VIEW: SCORECARD & 2-WAY TEACHER CONFIRMATION  */}
      {/* ======================================================== */}
      {viewState === 'results' && activeTest && latestSubmission && (
        <div className="card shadow-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl rounded-3xl p-6 sm:p-8">
          {/* Confirmed Banner */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-zinc-800 dark:to-zinc-800 border border-blue-100 dark:border-zinc-700 text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
              <Trophy size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Assessment Submitted!</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Your exam has been securely submitted and recorded for Teacher <strong className="text-slate-900 dark:text-white">{activeTest.assignedByTeacherName}</strong>.
            </p>

            {/* Scorecard Metrics */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <div>
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                  {latestSubmission.earnedMarks} / {latestSubmission.totalMarks}
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Points Scored</div>
              </div>
              <div className="h-10 w-px bg-slate-300 dark:bg-zinc-700" />
              <div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {latestSubmission.percentage}%
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Accuracy</div>
              </div>
              <div className="h-10 w-px bg-slate-300 dark:bg-zinc-700" />
              <div>
                {(() => {
                  const b = getGradeBand(latestSubmission.percentage);
                  return (
                    <div className={`px-3 py-1 rounded-xl border text-sm font-black ${b.color}`}>
                      Grade {b.grade}
                    </div>
                  );
                })()}
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mt-1">ACARA Band</div>
              </div>
            </div>
          </div>

          {/* Question Review Breakdown */}
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HelpCircle size={16} className="text-blue-500" /> Question-by-Question Review
          </h3>

          <div className="space-y-4">
            {(activeTest.questions || []).map((q, idx) => {
              const studentAns = latestSubmission.answers[q.number];
              const isCorrect = studentAns && studentAns.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
              return (
                <div
                  key={idx}
                  className={`p-4 sm:p-5 rounded-2xl border ${
                    isCorrect
                      ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {isCorrect ? <Check size={14} /> : <X size={14} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-2">
                        {q.number}. {q.question_text}
                      </p>

                      <div className="text-xs space-y-1">
                        <div className={isCorrect ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-red-700 dark:text-red-300 font-semibold'}>
                          Your Response: {studentAns || '(Unanswered)'}
                        </div>
                        {!isCorrect && (
                          <div className="text-emerald-700 dark:text-emerald-300 font-semibold">
                            Correct Answer: {q.correct_answer}
                          </div>
                        )}
                      </div>

                      {q.explanation && (
                        <div className="mt-3 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          <strong>Teacher Explanation: </strong>{q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (isDeadlineExpired(activeTest.deadline)) {
                  alert('The declared deadline for this assessment has expired. Retakes are not allowed.');
                  return;
                }
                setViewState('testing');
                setCurrentQIndex(0);
                setAnswers({});
                setTestStartTime(Date.now());
                setSecondsRemaining((activeTest.timeLimitMinutes || 20) * 60);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              <span>Retake Test</span>
            </button>

            <button
              type="button"
              onClick={() => setViewState('roster')}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
            >
              <span>Back to Class Assessments</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default StudentTestEnvironmentPage;
