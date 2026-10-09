import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Backpack, UserPlus, X, Shield, 
  Settings2, Sliders, Search, 
  CheckCircle2, Mail, Lock, Unlock,
  Clock, Check, RefreshCw, XCircle, UserX
} from 'lucide-react';
import { useAuth } from '../../services/authService';
import { listApprovalRequests, approveUser, type ApprovalRequest } from '../../services/roleService';

interface StudentUser {
  id: string;
  name: string;
  email: string;
  yearLevel: string;
  classroom: string;
  status: 'active' | 'frozen';
  aiUsageToday: number;
  aiDailyLimit: number;
  toolsAllowed: {
    socraticSandbox: boolean;
    textLeveler: boolean;
    quizMe: boolean;
    writingStudio: boolean;
    testEnvironment: boolean;
  };
}

const DEFAULT_STUDENTS: StudentUser[] = [
  {
    id: 's-1',
    name: 'Oliver Clarke',
    email: 'oliver.clarke@student.safescholar.edu.au',
    yearLevel: 'Year 4',
    classroom: 'Room 4B (Waratahs)',
    status: 'active',
    aiUsageToday: 8,
    aiDailyLimit: 30,
    toolsAllowed: {
      socraticSandbox: true,
      textLeveler: true,
      quizMe: true,
      writingStudio: true,
      testEnvironment: true,
    }
  },
  {
    id: 's-2',
    name: 'Mia Zhang',
    email: 'mia.zhang@student.safescholar.edu.au',
    yearLevel: 'Year 5',
    classroom: 'Room 5A (Kookaburras)',
    status: 'active',
    aiUsageToday: 14,
    aiDailyLimit: 40,
    toolsAllowed: {
      socraticSandbox: true,
      textLeveler: true,
      quizMe: true,
      writingStudio: true,
      testEnvironment: true,
    }
  },
  {
    id: 's-3',
    name: 'Noah Patterson',
    email: 'noah.patterson@student.safescholar.edu.au',
    yearLevel: 'Year 3',
    classroom: 'Room 3C (Wallabies)',
    status: 'active',
    aiUsageToday: 5,
    aiDailyLimit: 25,
    toolsAllowed: {
      socraticSandbox: true,
      textLeveler: true,
      quizMe: true,
      writingStudio: false,
      testEnvironment: true,
    }
  },
  {
    id: 's-4',
    name: 'Chloe Evans',
    email: 'chloe.evans@student.safescholar.edu.au',
    yearLevel: 'Prep',
    classroom: 'Prep Gold (Koalas)',
    status: 'active',
    aiUsageToday: 2,
    aiDailyLimit: 15,
    toolsAllowed: {
      socraticSandbox: true,
      textLeveler: true,
      quizMe: false,
      writingStudio: false,
      testEnvironment: false,
    }
  }
];

export const StudentManagementPage: React.FC = () => {
  const { tokens } = useAuth();
  const accessToken = tokens?.accessToken || null;

  const [students, setStudents] = useState<StudentUser[]>(() => {
    try {
      const saved = localStorage.getItem('safescholar_students_roster');
      return saved ? JSON.parse(saved) : DEFAULT_STUDENTS;
    } catch {
      return DEFAULT_STUDENTS;
    }
  });

  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [activeView, setActiveView] = useState<'roster' | 'approvals'>('roster');
  const [rejectingReq, setRejectingReq] = useState<ApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [approvalSearch, setApprovalSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // New Student Form
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newYear, setNewYear] = useState('Year 4');
  const [newClassroom, setNewClassroom] = useState('Room 4A');
  const [newDailyLimit, setNewDailyLimit] = useState(30);

  async function loadApprovals() {
    if (!accessToken) return;
    setLoadingApprovals(true);
    try {
      const res = await listApprovalRequests(accessToken);
      const all = res.requests || [];
      const studentOnly = all.filter(
        (r) => r.requestedRole?.toLowerCase() === 'student' || r.requestType?.toLowerCase() === 'student'
      );
      setApprovalRequests(studentOnly);
    } catch (e) {
      console.error('Failed to load student approval requests:', e);
    } finally {
      setLoadingApprovals(false);
    }
  }

  useEffect(() => {
    void loadApprovals();
  }, [accessToken]);

  useEffect(() => {
    localStorage.setItem('safescholar_students_roster', JSON.stringify(students));
  }, [students]);

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleApproveStudent = async (req: ApprovalRequest) => {
    if (!accessToken) return;
    setProcessingId(req.requestId);
    try {
      await approveUser(accessToken, req.userId, 'active');
      showNotification(`Student ${req.firstName} ${req.lastName} (${req.email}) authorized & activated.`);

      const yearLevel = (req.metadata?.academic_year as string) || (req.metadata?.academicYear as string) || (req.metadata?.grade as string) || 'Year 4';
      const classroom = (req.metadata?.department as string) || 'General Learner';

      const newS: StudentUser = {
        id: req.userId,
        name: `${req.firstName} ${req.lastName}`.trim() || req.email,
        email: req.email,
        yearLevel,
        classroom,
        status: 'active',
        aiUsageToday: 0,
        aiDailyLimit: 30,
        toolsAllowed: {
          socraticSandbox: true,
          textLeveler: true,
          quizMe: true,
          writingStudio: true,
          testEnvironment: true
        }
      };

      setStudents((prev) => {
        if (prev.some((s) => s.id === newS.id || s.email.toLowerCase() === newS.email.toLowerCase())) {
          return prev;
        }
        return [newS, ...prev];
      });

      await loadApprovals();
    } catch (e: any) {
      showNotification(`Failed to approve student: ${e?.message || 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmRejectStudent = async () => {
    if (!accessToken || !rejectingReq) return;
    setProcessingId(rejectingReq.requestId);
    try {
      await approveUser(accessToken, rejectingReq.userId, 'rejected', undefined, rejectionReason);
      showNotification(`Signup request for ${rejectingReq.email} has been rejected.`);
      setRejectingReq(null);
      setRejectionReason('');
      await loadApprovals();
    } catch (e: any) {
      showNotification(`Failed to reject request: ${e?.message || 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleTool = (studentId: string, toolKey: keyof StudentUser['toolsAllowed']) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          const updated = {
            ...s,
            toolsAllowed: {
              ...s.toolsAllowed,
              [toolKey]: !s.toolsAllowed[toolKey]
            }
          };
          if (selectedStudent && selectedStudent.id === studentId) {
            setSelectedStudent(updated);
          }
          return updated;
        }
        return s;
      })
    );
    showNotification('Student AI tool permission updated.');
  };

  const handleToggleFreeze = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          const newStatus = s.status === 'active' ? 'frozen' : 'active';
          const updated = { ...s, status: newStatus as 'active' | 'frozen' };
          if (selectedStudent && selectedStudent.id === studentId) {
            setSelectedStudent(updated);
          }
          return updated;
        }
        return s;
      })
    );
    showNotification('Safety intervention status toggled.');
  };

  const handleUpdateLimit = (studentId: string, limitVal: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          const updated = { ...s, aiDailyLimit: limitVal };
          if (selectedStudent && selectedStudent.id === studentId) {
            setSelectedStudent(updated);
          }
          return updated;
        }
        return s;
      })
    );
    showNotification(`Daily request quota set to ${limitVal}`);
  };

  const handleOnboardStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newFirstName.trim()) return;

    const newS: StudentUser = {
      id: `s-${Date.now()}`,
      name: `${newFirstName.trim()} ${newLastName.trim()}`,
      email: newEmail.trim(),
      yearLevel: newYear,
      classroom: newClassroom,
      status: 'active',
      aiUsageToday: 0,
      aiDailyLimit: newDailyLimit,
      toolsAllowed: {
        socraticSandbox: true,
        textLeveler: true,
        quizMe: true,
        writingStudio: true,
        testEnvironment: true
      }
    };

    setStudents([newS, ...students]);
    setShowOnboardModal(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    showNotification(`Student ${newS.name} enrolled into ${newS.yearLevel}.`);
  };

  const pendingRequests = approvalRequests.filter((r) => r.status?.toUpperCase() === 'PENDING');
  const pendingCount = pendingRequests.length;

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.yearLevel.toLowerCase().includes(search.toLowerCase()) ||
      s.classroom.toLowerCase().includes(search.toLowerCase())
  );

  const filteredApprovals = approvalRequests.filter((r) => {
    const q = approvalSearch.toLowerCase();
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const ay = ((r.metadata?.academic_year as string) || (r.metadata?.academicYear as string) || '').toLowerCase();
    const sid = ((r.metadata?.student_id_number as string) || (r.metadata?.studentIdNumber as string) || '').toLowerCase();
    return (
      fullName.includes(q) ||
      r.email.toLowerCase().includes(q) ||
      ay.includes(q) ||
      sid.includes(q)
    );
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      {/* Toast Notification */}
      <AnimatePresence>
        {saveToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-600 text-white shadow-xl text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            <span>{saveToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden mb-6">
        <div className="cardInner p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 shrink-0">
                <Backpack size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Student Management</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                    Prep to Year 5
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Authorize student registrations, configure safety locks, assign learning tools, and manage quotas.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOnboardModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all self-start sm:self-center"
            >
              <UserPlus size={15} />
              <span>Enroll New Student</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pending Approvals Quick Alert Banner */}
      {pendingCount > 0 && activeView !== 'approvals' && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Pending Student Signup Requests
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {pendingCount} Pending
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                There are {pendingCount} learner registration(s) awaiting your institute authorization.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('approvals')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span>Review Requests</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white text-amber-700 font-black">
              {pendingCount}
            </span>
          </button>
        </div>
      )}

      {/* View Switcher Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('roster')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === 'roster'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-white/60 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700'
            }`}
          >
            <Backpack size={15} />
            <span>Student Learners ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('approvals')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === 'approvals'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-white/60 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700'
            }`}
          >
            <Clock size={15} />
            <span>Pending Approvals</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {activeView === 'approvals' && (
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-56">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter student requests..."
                value={approvalSearch}
                onChange={(e) => setApprovalSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadApprovals()}
              disabled={loadingApprovals}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw size={13} className={loadingApprovals ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* Main View Contents */}
      {activeView === 'approvals' ? (
        <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield size={18} className="text-emerald-600" />
                Student Signup Requests ({approvalRequests.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Authorize or reject student candidates who registered for your institution. Upon authorization, accounts are activated with safe student access.
              </p>
            </div>
          </div>

          {approvalRequests.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Student Signup Requests
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                All student registrations for your institution have been reviewed and processed. New incoming student signups will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3.5">Candidate Learner</th>
                    <th className="px-4 py-3.5">Academic Year / Grade</th>
                    <th className="px-4 py-3.5">Student ID Number</th>
                    <th className="px-4 py-3.5">Department / Classroom</th>
                    <th className="px-4 py-3.5">Requested On</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white/50 dark:bg-zinc-900/50">
                  {filteredApprovals.map((req) => {
                    const isProcessing = processingId === req.requestId;
                    const isPending = req.status === 'PENDING';
                    const academicYear = (req.metadata?.academic_year as string) || (req.metadata?.academicYear as string) || (req.metadata?.grade as string) || 'Year 4';
                    const studentIdNum = (req.metadata?.student_id_number as string) || (req.metadata?.studentIdNumber as string) || (req.metadata?.student_id as string) || '—';
                    const dept = (req.metadata?.department as string) || 'General';
                    const dateFormatted = new Date(req.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr key={req.requestId} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center uppercase shrink-0 text-xs">
                              {(req.firstName?.[0] || '') + (req.lastName?.[0] || 'S')}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs">
                                {req.firstName} {req.lastName}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                <Mail size={11} /> {req.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold text-[11px]">
                            {academicYear}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {studentIdNum}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          {dept}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                          {dateFormatted}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => void handleApproveStudent(req)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
                              >
                                <Check size={13} />
                                <span>{isProcessing ? 'Processing...' : 'Authorize'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => {
                                  setRejectingReq(req);
                                  setRejectionReason('');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-300 dark:border-red-800/80 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 font-bold text-xs transition-all"
                              >
                                <XCircle size={13} />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Reviewed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Student Learners Roster Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Roster Column */}
          <div className="lg:col-span-7">
            <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Student Learners ({students.length})
                </h3>
                <div className="relative w-48 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter students..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredStudents.map((s) => {
                  const isSelected = selectedStudent?.id === s.id;
                  const isFrozen = s.status === 'frozen';
                  const usagePct = Math.round((s.aiUsageToday / s.aiDailyLimit) * 100);
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-md ring-1 ring-emerald-400'
                          : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-white/60 dark:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isFrozen
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {isFrozen ? 'Suspended' : s.yearLevel}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <Mail size={12} />
                            <span>{s.email}</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                            {s.classroom}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {s.aiUsageToday} / {s.aiDailyLimit}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Today's Cap</div>
                          <div className="w-20 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden ml-auto">
                            <div
                              className={`h-full rounded-full ${usagePct > 80 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                              style={{ width: `${Math.min(100, usagePct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Student Controls */}
          <div className="lg:col-span-5">
            {selectedStudent ? (
              <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Learner Profile
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedStudent.name}
                    </h3>
                    <p className="text-xs text-slate-500">{selectedStudent.yearLevel} • {selectedStudent.classroom}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFreeze(selectedStudent.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all ${
                      selectedStudent.status === 'frozen'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {selectedStudent.status === 'frozen' ? <Unlock size={14} /> : <Lock size={14} />}
                    <span>{selectedStudent.status === 'frozen' ? 'Unlock Session' : 'Freeze Session'}</span>
                  </button>
                </div>

                {/* AI Daily Cap */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Sliders size={14} className="text-emerald-500" /> Daily AI Prompts Cap
                    </span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {selectedStudent.aiDailyLimit} prompts
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={selectedStudent.aiDailyLimit}
                    onChange={(e) => handleUpdateLimit(selectedStudent.id, Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>10 / day</span>
                    <span>50 / day</span>
                    <span>100 / day</span>
                  </div>
                </div>

                {/* Tool Assignment Toggles */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Shield size={14} className="text-teal-500" /> Authorized Student Tools
                  </h4>

                  <div className="space-y-2">
                    {[
                      { key: 'socraticSandbox', label: 'Socratic Sandbox AI Chat' },
                      { key: 'textLeveler', label: 'Reading Helper (Text Leveler)' },
                      { key: 'quizMe', label: 'AI Quiz Me (Interactive Self-Assess)' },
                      { key: 'writingStudio', label: 'Writing Studio (NAPLAN Coach)' },
                      { key: 'testEnvironment', label: 'Test Environment (Online Exams)' }
                    ].map((tool) => {
                      const isAllowed = selectedStudent.toolsAllowed[tool.key as keyof StudentUser['toolsAllowed']];
                      return (
                        <div
                          key={tool.key}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{tool.label}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleTool(selectedStudent.id, tool.key as keyof StudentUser['toolsAllowed'])}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                              isAllowed ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
                            }`}
                          >
                            <motion.div
                              animate={{ x: isAllowed ? 20 : 0 }}
                              className="w-4 h-4 rounded-full bg-white shadow-md"
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card shadow-lg border border-dashed border-slate-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[360px]">
                <Settings2 size={32} className="text-slate-400 mb-3" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Select a Student</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Click on any enrolled learner from the roster to adjust daily prompt limits or toggle student tool authorizations.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      <AnimatePresence>
        {rejectingReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserX size={18} className="text-red-500" /> Reject Student Request
                </h4>
                <button
                  onClick={() => setRejectingReq(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-3">
                Are you sure you want to reject the student registration request for{' '}
                <strong className="text-slate-900 dark:text-white">{rejectingReq.firstName} {rejectingReq.lastName} ({rejectingReq.email})</strong>?
              </p>

              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Ineligible enrollment details or unverified student ID number"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingReq(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processingId === rejectingReq.requestId}
                  onClick={() => void handleConfirmRejectStudent()}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {processingId === rejectingReq.requestId ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Enrollment Modal */}
      <AnimatePresence>
        {showOnboardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-zinc-800"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus size={18} className="text-emerald-500" /> Enroll Student
                </h3>
                <button
                  onClick={() => setShowOnboardModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleOnboardStudent} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="e.g. Lucas"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="e.g. Miller"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Student Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="lucas.miller@student.safescholar.edu.au"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Year Band</label>
                    <select
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                    >
                      {['Prep', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Classroom / House</label>
                    <input
                      type="text"
                      value={newClassroom}
                      onChange={(e) => setNewClassroom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Daily AI Quota</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={newDailyLimit}
                    onChange={(e) => setNewDailyLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
                  >
                    Confirm Enrollment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StudentManagementPage;
