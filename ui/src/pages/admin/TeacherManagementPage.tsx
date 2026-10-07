import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, UserPlus, X, Shield, 
  Settings2, Sliders, Search, 
  CheckCircle2, Mail
} from 'lucide-react';

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
  const [teachers, setTeachers] = useState<TeacherUser[]>(() => {
    try {
      const saved = localStorage.getItem('safescholar_teachers_roster');
      return saved ? JSON.parse(saved) : DEFAULT_TEACHERS;
    } catch {
      return DEFAULT_TEACHERS;
    }
  });

  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // New Teacher Form
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDept, setNewDept] = useState('Primary Years (Year 4)');
  const [newLimit, setNewLimit] = useState(250);

  useEffect(() => {
    localStorage.setItem('safescholar_teachers_roster', JSON.stringify(teachers));
  }, [teachers]);

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

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      {/* Toast */}
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
                  Onboard educators, delegate tool permissions, and configure monthly AI request limits.
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

      {/* Roster & Tool Delegation Grid */}
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

              {/* AI Request Quota Slider */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sliders size={14} className="text-blue-500" /> Monthly AI Request Cap
                  </span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {selectedTeacher.aiMonthlyLimit} reqs
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={25}
                  value={selectedTeacher.aiMonthlyLimit}
                  onChange={(e) => handleUpdateLimit(selectedTeacher.id, Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>50 reqs</span>
                  <span>250 reqs</span>
                  <span>500 reqs</span>
                </div>
              </div>

              {/* Tool Assignment Toggles */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Shield size={14} className="text-emerald-500" /> Assigned AI Tools
                </h4>

                <div className="space-y-2">
                  {[
                    { key: 'lessonPlanner', label: 'Lesson Planner (ACARA v9.0)' },
                    { key: 'rubricGenerator', label: 'Rubric Generator (ISMG Criteria)' },
                    { key: 'worksheetGenerator', label: 'Worksheet Generator (Prep - Year 5)' },
                    { key: 'assessmentGenerator', label: 'Assessment & Test Generator' },
                    { key: 'customBot', label: 'Custom Socratic Bot Studio' },
                    { key: 'textLeveler', label: 'Text Complexity Leveler' }
                  ].map((tool) => {
                    const isAllowed = selectedTeacher.toolsAllowed[tool.key as keyof TeacherUser['toolsAllowed']];
                    return (
                      <div
                        key={tool.key}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{tool.label}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleTool(selectedTeacher.id, tool.key as keyof TeacherUser['toolsAllowed'])}
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
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Select an Educator</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Click on any teacher from the roster to adjust their tool permissions and monthly AI generation quotas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Onboard Modal */}
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Department / Stage</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
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
