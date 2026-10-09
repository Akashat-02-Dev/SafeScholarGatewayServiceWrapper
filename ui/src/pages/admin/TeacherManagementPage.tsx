import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, UserPlus, X, Shield, 
  Settings2, Sliders, Search, 
  CheckCircle2, Mail, Clock, Check, RefreshCw, XCircle, UserX
} from 'lucide-react';
import { useAuth } from '../../services/authService';
import { listApprovalRequests, approveUser, type ApprovalRequest } from '../../services/roleService';

interface TeacherUser {
  id: string;
  name: string;
  email: string;
  department: string;
  gradeLevels: string[];
  status: 'active' | 'pending' | 'suspended';
  aiUsageCount: number;
  aiMonthlyLimit: number;
  toolsAllowed: {
    lessonPlanner: boolean;
    rubricGenerator: boolean;
    worksheetGenerator: boolean;
    assessmentGenerator: boolean;
    customBot: boolean;
    textLeveler: boolean;
  };
}

const DEFAULT_TEACHERS: TeacherUser[] = [
  {
    id: 't-1',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@safescholar.edu.au',
    department: 'Primary Years (Year 3)',
    gradeLevels: ['Year 3'],
    status: 'active',
    aiUsageCount: 42,
    aiMonthlyLimit: 200,
    toolsAllowed: {
      lessonPlanner: true,
      rubricGenerator: true,
      worksheetGenerator: true,
      assessmentGenerator: true,
      customBot: true,
      textLeveler: true,
    }
  },
  {
    id: 't-2',
    name: 'David MacLeod',
    email: 'david.macleod@safescholar.edu.au',
    department: 'STEM & Mathematics (Years 4-5)',
    gradeLevels: ['Year 4', 'Year 5'],
    status: 'active',
    aiUsageCount: 88,
    aiMonthlyLimit: 300,
    toolsAllowed: {
      lessonPlanner: true,
      rubricGenerator: true,
      worksheetGenerator: true,
      assessmentGenerator: true,
      customBot: false,
      textLeveler: true,
    }
  },
  {
    id: 't-3',
    name: 'Emily Watson',
    email: 'emily.watson@safescholar.edu.au',
    department: 'Early Childhood (Prep - Year 1)',
    gradeLevels: ['Prep', 'Year 1'],
    status: 'active',
    aiUsageCount: 19,
    aiMonthlyLimit: 150,
    toolsAllowed: {
      lessonPlanner: true,
      rubricGenerator: false,
      worksheetGenerator: true,
      assessmentGenerator: false,
      customBot: false,
      textLeveler: true,
    }
  }
];

export const TeacherManagementPage: React.FC = () => {
  const { tokens } = useAuth();
  const accessToken = tokens?.accessToken || null;

  const [teachers, setTeachers] = useState<TeacherUser[]>(() => {
    try {
      const saved = localStorage.getItem('safescholar_teachers_roster');
      return saved ? JSON.parse(saved) : DEFAULT_TEACHERS;
    } catch {
      return DEFAULT_TEACHERS;
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
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // New Teacher Form
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDept, setNewDept] = useState('Primary Years (Year 4)');
  const [newLimit, setNewLimit] = useState(250);

  async function loadApprovals() {
    if (!accessToken) return;
    setLoadingApprovals(true);
    try {
      const res = await listApprovalRequests(accessToken);
      const all = res.requests || [];
      const teacherOnly = all.filter(
        (r) => r.requestedRole?.toLowerCase() === 'teacher' || r.requestType?.toLowerCase() === 'teacher'
      );
      setApprovalRequests(teacherOnly);
    } catch (e) {
      console.error('Failed to load teacher approval requests:', e);
    } finally {
      setLoadingApprovals(false);
    }
  }

  useEffect(() => {
    void loadApprovals();
  }, [accessToken]);

  useEffect(() => {
    localStorage.setItem('safescholar_teachers_roster', JSON.stringify(teachers));
  }, [teachers]);

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleApproveTeacher = async (req: ApprovalRequest) => {
    if (!accessToken) return;
    setProcessingId(req.requestId);
    try {
      await approveUser(accessToken, req.userId, 'active');
      showNotification(`Educator ${req.firstName} ${req.lastName} (${req.email}) authorized & activated.`);

      const newT: TeacherUser = {
        id: req.userId,
        name: `${req.firstName} ${req.lastName}`.trim() || req.email,
        email: req.email,
        department: (req.metadata?.department as string) || (req.metadata?.designation as string) || 'Primary Faculty',
        gradeLevels: ['Year 3', 'Year 4'],
        status: 'active',
        aiUsageCount: 0,
        aiMonthlyLimit: 250,
        toolsAllowed: {
          lessonPlanner: true,
          rubricGenerator: true,
          worksheetGenerator: true,
          assessmentGenerator: true,
          customBot: true,
          textLeveler: true
        }
      };

      setTeachers((prev) => {
        if (prev.some((t) => t.id === newT.id || t.email.toLowerCase() === newT.email.toLowerCase())) {
          return prev;
        }
        return [newT, ...prev];
      });

      await loadApprovals();
    } catch (e: any) {
      showNotification(`Failed to approve teacher: ${e?.message || 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmRejectTeacher = async () => {
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

  const handleToggleTool = (teacherId: string, toolKey: keyof TeacherUser['toolsAllowed']) => {
    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id === teacherId) {
          const updated = {
            ...t,
            toolsAllowed: {
              ...t.toolsAllowed,
              [toolKey]: !t.toolsAllowed[toolKey]
            }
          };
          if (selectedTeacher && selectedTeacher.id === teacherId) {
            setSelectedTeacher(updated);
          }
          return updated;
        }
        return t;
      })
    );
    showNotification('Tool permission updated successfully');
  };

  const handleUpdateLimit = (teacherId: string, newLimitVal: number) => {
    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id === teacherId) {
          const updated = { ...t, aiMonthlyLimit: newLimitVal };
          if (selectedTeacher && selectedTeacher.id === teacherId) {
            setSelectedTeacher(updated);
          }
          return updated;
        }
        return t;
      })
    );
    showNotification(`AI Monthly limit set to ${newLimitVal} requests`);
  };

  const handleOnboardTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newFirstName.trim()) return;

    const newT: TeacherUser = {
      id: `t-${Date.now()}`,
      name: `${newFirstName.trim()} ${newLastName.trim()}`,
      email: newEmail.trim(),
      department: newDept,
      gradeLevels: ['Year 3', 'Year 4'],
      status: 'active',
      aiUsageCount: 0,
      aiMonthlyLimit: newLimit,
      toolsAllowed: {
        lessonPlanner: true,
        rubricGenerator: true,
        worksheetGenerator: true,
        assessmentGenerator: true,
        customBot: true,
        textLeveler: true
      }
    };

    setTeachers([newT, ...teachers]);
    setShowOnboardModal(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    showNotification(`Teacher ${newT.name} onboarded with full ACARA permissions.`);
  };

  const pendingRequests = approvalRequests.filter((r) => r.status?.toUpperCase() === 'PENDING');
  const pendingCount = pendingRequests.length;

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.department.toLowerCase().includes(search.toLowerCase())
  );

  const filteredApprovals = approvalRequests.filter((r) => {
    const q = approvalSearch.toLowerCase();
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const dept = ((r.metadata?.department as string) || '').toLowerCase();
    const empId = ((r.metadata?.employee_id as string) || '').toLowerCase();
    return (
      fullName.includes(q) ||
      r.email.toLowerCase().includes(q) ||
      dept.includes(q) ||
      empId.includes(q)
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
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 shrink-0">
                <GraduationCap size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Teacher Management</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wide">
                    Institute Admin
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Review incoming teacher registrations, delegate tool permissions, and configure monthly AI quotas.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOnboardModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all self-start sm:self-center"
            >
              <UserPlus size={15} />
              <span>Onboard New Teacher</span>
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
                Pending Educator Signup Requests
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {pendingCount} Pending
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                There are {pendingCount} educator account request(s) awaiting your review and authorization.
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
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white/60 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700'
            }`}
          >
            <GraduationCap size={15} />
            <span>Faculty Roster ({teachers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('approvals')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeView === 'approvals'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
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
                placeholder="Filter requests..."
                value={approvalSearch}
                onChange={(e) => setApprovalSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <Shield size={18} className="text-blue-600" />
                Teacher Signup Requests ({approvalRequests.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Authorize or reject faculty members who registered for your institution. Upon authorization, accounts are activated and granted ACARA tools.
              </p>
            </div>
          </div>

          {approvalRequests.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Teacher Signup Requests
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                All teacher registrations for your institution have been reviewed and processed. New incoming requests will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3.5">Candidate Educator</th>
                    <th className="px-4 py-3.5">Department / Subject</th>
                    <th className="px-4 py-3.5">Employee ID</th>
                    <th className="px-4 py-3.5">Designation</th>
                    <th className="px-4 py-3.5">Requested On</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white/50 dark:bg-zinc-900/50">
                  {filteredApprovals.map((req) => {
                    const isProcessing = processingId === req.requestId;
                    const isPending = req.status === 'PENDING';
                    const dept = (req.metadata?.department as string) || (req.metadata?.dept as string) || 'General Faculty';
                    const empId = (req.metadata?.employee_id as string) || (req.metadata?.employeeId as string) || '—';
                    const designation = (req.metadata?.designation as string) || 'Teacher';
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
                            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center uppercase shrink-0 text-xs">
                              {(req.firstName?.[0] || '') + (req.lastName?.[0] || 'T')}
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
                          {dept}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {empId}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          {designation}
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
                                onClick={() => void handleApproveTeacher(req)}
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
        /* Roster & Tool Delegation Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Teachers List Column */}
          <div className="lg:col-span-7">
            <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Educator Roster ({teachers.length})
                </h3>
                <div className="relative w-48 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter teachers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredTeachers.map((t) => {
                  const isSelected = selectedTeacher?.id === t.id;
                  const usagePct = Math.round((t.aiUsageCount / t.aiMonthlyLimit) * 100);
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTeacher(t)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-md ring-1 ring-blue-400'
                          : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-white/60 dark:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{t.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {t.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <Mail size={12} />
                            <span>{t.email}</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                            {t.department}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            {t.aiUsageCount} / {t.aiMonthlyLimit}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">AI Requests</div>
                          <div className="w-20 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden ml-auto">
                            <div
                              className={`h-full rounded-full ${usagePct > 80 ? 'bg-amber-500' : 'bg-blue-600'}`}
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

          {/* Selected Teacher Permissions & Limits */}
          <div className="lg:col-span-5">
            {selectedTeacher ? (
              <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 space-y-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Tool Governance
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedTeacher.name}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedTeacher.department}</p>
                </div>

                {/* Quota Slider */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Sliders size={14} className="text-blue-600" /> Monthly Generation Quota
                    </span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                      {selectedTeacher.aiMonthlyLimit} reqs
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="25"
                    value={selectedTeacher.aiMonthlyLimit}
                    onChange={(e) => handleUpdateLimit(selectedTeacher.id, Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>50 (Restricted)</span>
                    <span>500 (Standard)</span>
                    <span>1000 (Department Head)</span>
                  </div>
                </div>

                {/* Tool Delegations */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Shield size={13} /> Active ACARA Tool Permissions
                  </h4>

                  {[
                    { key: 'lessonPlanner', label: 'ACARA Lesson Plan Architect', desc: 'Generate multi-week lesson sequences linked to syllabus codes.' },
                    { key: 'rubricGenerator', label: 'Rubric & Marking Matrix Engine', desc: 'Create 4-point achievement level assessment criteria.' },
                    { key: 'worksheetGenerator', label: 'Differentiated Worksheet Generator', desc: 'Produce leveled student activities with tiered difficulty.' },
                    { key: 'assessmentGenerator', label: 'Summative Assessment Studio', desc: 'Create standards-based exams and exit tickets.' },
                    { key: 'textLeveler', label: 'Reading Level Transformer (Lexile)', desc: 'Re-level source reading texts to accommodate reader tiers.' },
                    { key: 'customBot', label: 'Custom Classroom Assistant Persona', desc: 'Deploy tailored pedagogical bots with customized safety prompts.' },
                  ].map((tool) => {
                    const isAllowed = selectedTeacher.toolsAllowed[tool.key as keyof TeacherUser['toolsAllowed']];
                    return (
                      <div
                        key={tool.key}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white/40 dark:bg-zinc-800/40"
                      >
                        <div className="pr-2">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{tool.label}</div>
                          <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{tool.desc}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleTool(selectedTeacher.id, tool.key as keyof TeacherUser['toolsAllowed'])}
                          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                            isAllowed ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-600'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                              isAllowed ? 'left-6' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card shadow-lg border border-dashed border-slate-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[360px]">
                <Settings2 size={32} className="text-slate-400 mb-3" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Select an Educator</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Click on any teacher from the roster to adjust their tool permissions and monthly AI generation quotas.
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
                  <UserX size={18} className="text-red-500" /> Reject Signup Request
                </h4>
                <button
                  onClick={() => setRejectingReq(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-3">
                Are you sure you want to reject the teacher registration request for{' '}
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
                  placeholder="e.g. Unverified faculty credentials or invalid departmental allocation"
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
                  onClick={() => void handleConfirmRejectTeacher()}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {processingId === rejectingReq.requestId ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Onboard Modal */}
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
                  <UserPlus size={18} className="text-blue-500" /> Onboard Educator
                </h3>
                <button
                  onClick={() => setShowOnboardModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleOnboardTeacher} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="e.g. Liam"
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
                      placeholder="e.g. Harrison"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="liam.harrison@safescholar.edu.au"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Department / Stage</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Initial AI Quota (reqs/month)</label>
                  <input
                    type="number"
                    min={20}
                    max={1000}
                    value={newLimit}
                    onChange={(e) => setNewLimit(Number(e.target.value))}
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
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
                  >
                    Confirm Onboarding
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

export default TeacherManagementPage;
