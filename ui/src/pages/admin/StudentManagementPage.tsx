import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Backpack, UserPlus, X, Shield, 
  Settings2, Sliders, Search, 
  CheckCircle2, Mail, Lock, Unlock
} from 'lucide-react';

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
  const [students, setStudents] = useState<StudentUser[]>(() => {
    try {
      const saved = localStorage.getItem('safescholar_students_roster');
      return saved ? JSON.parse(saved) : DEFAULT_STUDENTS;
    } catch {
      return DEFAULT_STUDENTS;
    }
  });

  const [search, setSearch] = useState('');
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

  useEffect(() => {
    localStorage.setItem('safescholar_students_roster', JSON.stringify(students));
  }, [students]);

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

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.yearLevel.toLowerCase().includes(search.toLowerCase()) ||
      s.classroom.toLowerCase().includes(search.toLowerCase())
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
                  Enroll learners, configure safety locks, assign student tools, and monitor AI safety.
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

      {/* Grid */}
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
                  className="w-full accent-emerald-600"
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
                      placeholder="e.g. Miller"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Year Band</label>
                    <select
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
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
