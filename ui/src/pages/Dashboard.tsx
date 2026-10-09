import { useEffect, useState } from 'react';
import { useRoleFilter } from '../services/roleFilterContext';
import { motion } from 'framer-motion';
import { 
  Shield, Building2, GraduationCap, 
  BookOpen, CheckSquare, Sparkles,
  ClipboardList, Backpack, FileSpreadsheet,
  Scissors, PenTool, Bot, Database, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RoleFilterBar } from '../components/RoleFilterBar';

export function Dashboard() {
  const { isSuperAdmin, effectiveRole } = useRoleFilter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div style={{ fontWeight: '600', color: 'var(--muted)' }}>Loading workspace dashboard...</div>
      </div>
    );
  }

  function renderSuperAdminQuickBar(portalName: string) {
    if (!isSuperAdmin) return null;
    return (
      <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 dark:border-amber-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-sm shrink-0">
            <Shield size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
              Super Admin Controls
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300">
                {portalName}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Multi-tenant institute onboarding, teacher/student quotas, and real-time AI token usage.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Link
            to="/superadmin"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all whitespace-nowrap"
          >
            <Shield size={13} /> Open Super Admin Hub
          </Link>
          <RoleFilterBar compact />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 🍎 TEACHER VIEW (If effective role is teacher)
  // ----------------------------------------------------
  if (effectiveRole === 'teacher') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
        {renderSuperAdminQuickBar('Teacher View')}

        <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-7">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <GraduationCap size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Educator Workspace</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Australian Curriculum Prep to Year 5 Lesson Architecture & Assessment</p>
            </div>
          </div>

          {/* Quick Tools Grid - EXACT 6 TEACHER TOOLS */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Teacher AI Tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Link to="/educator/lesson-planner" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-blue-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                  <BookOpen size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600">Lesson Planner</div>
                <div className="text-xs text-slate-500 mt-1">ACARA v9.0 outcomes, tiered differentiation & cognitive verbs.</div>
              </Link>

              <Link to="/educator/rubric-generator" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-teal-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5">
                  <ClipboardList size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600">Rubric Generator</div>
                <div className="text-xs text-slate-500 mt-1">QCAA ISMG marking criteria with 4-tier standards matrix.</div>
              </Link>

              <Link to="/educator/worksheet-generator" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-orange-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-2.5">
                  <FileSpreadsheet size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-orange-600">Worksheet Generator</div>
                <div className="text-xs text-slate-500 mt-1">Kura Plan style printable student activities with answer keys.</div>
              </Link>

              <Link to="/educator/assessment-generator" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-indigo-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5">
                  <CheckSquare size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600">Assessment & Quiz Generator</div>
                <div className="text-xs text-slate-500 mt-1">Formative checkpoints & NAPLAN practice tests with digital grading.</div>
              </Link>

              <Link to="/educator/custom-bots" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-purple-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5">
                  <Sparkles size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600">Custom Chat Bot</div>
                <div className="text-xs text-slate-500 mt-1">Build specialized Socratic tutors grounded in your classroom docs.</div>
              </Link>

              <Link to="/educator/leveler" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-cyan-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2.5">
                  <Scissors size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600">Text Leveler</div>
                <div className="text-xs text-slate-500 mt-1">Differentiate passages across Prep to Year 5 Lexile complexity.</div>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ----------------------------------------------------
  // 🎒 STUDENT VIEW (If effective role is student)
  // ----------------------------------------------------
  if (effectiveRole === 'student') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
        {renderSuperAdminQuickBar('Student Hub')}

        <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-7">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md">
              <Backpack size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Student Learning Hub</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Interactive Socratic Tutor, Reading Support & Test Environment</p>
            </div>
          </div>

          {/* Quick Tools Grid - EXACT 5 STUDENT TOOLS */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Student Learning Tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Link to="/socratic-tutor" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-blue-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                  <Sparkles size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600">Socratic Sandbox AI Chat</div>
                <div className="text-xs text-slate-500 mt-1">Real-time Socratic guiding tutor. Ask questions and discover answers.</div>
              </Link>

              <Link to="/student/text-leveler" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-cyan-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2.5">
                  <Scissors size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600">Reading Leveler</div>
                <div className="text-xs text-slate-500 mt-1">Simplify difficult texts and listen with Australian voice audio.</div>
              </Link>

              <Link to="/student/join-room" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-amber-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5">
                  <Bot size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600">Join Chatbot Room</div>
                <div className="text-xs text-slate-500 mt-1">Join custom Socratic chatbot rooms created and provided by your teacher.</div>
              </Link>

              <Link to="/student/writing-studio" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-indigo-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5">
                  <PenTool size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600">Writing Studio</div>
                <div className="text-xs text-slate-500 mt-1">Targeted writing feedback on structure, voice, and NAPLAN grammar.</div>
              </Link>

              <Link to="/student/test-environment" className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-emerald-400 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                  <CheckSquare size={18} />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600">Test Environment</div>
                <div className="text-xs text-slate-500 mt-1">Distraction-free digital exam room with automated scoring & review.</div>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ----------------------------------------------------
  // 🏛️ INSTITUTE MANAGEMENT VIEW (If effective role is institute)
  // ----------------------------------------------------
  if (effectiveRole === 'institute') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
        {renderSuperAdminQuickBar('Institute Management')}

        <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-7">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 text-white flex items-center justify-center shadow-md">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Institute Management Console</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Curriculum Grounding, Educator & Student Governance, and Reporting</p>
            </div>
          </div>

          {/* Quick Tools Grid - EXACT 4 INSTITUTE MANAGEMENT TOOLS */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Institute Administrative Modules</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link to="/admin/rag-ingestion" className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-purple-400 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                  <Database size={20} />
                </div>
                <div className="font-bold text-base text-slate-900 dark:text-white group-hover:text-purple-600">RAG Ingestion and Update</div>
                <div className="text-xs text-slate-500 mt-1">Upload school syllabi, curriculum PDFs and policies into vector embeddings.</div>
              </Link>

              <Link to="/admin/teachers" className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-blue-400 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                  <GraduationCap size={20} />
                </div>
                <div className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600">Teacher Management</div>
                <div className="text-xs text-slate-500 mt-1">Onboard staff, assign tool permissions and set monthly AI usage limits.</div>
              </Link>

              <Link to="/admin/students" className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-emerald-400 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <Backpack size={20} />
                </div>
                <div className="font-bold text-base text-slate-900 dark:text-white group-hover:text-emerald-600">Student Management</div>
                <div className="text-xs text-slate-500 mt-1">Enroll learners, set daily prompt quotas, and manage safety intervention locks.</div>
              </Link>

              <Link to="/admin/report-card" className="p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:shadow-md hover:border-indigo-400 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <ClipboardList size={20} />
                </div>
                <div className="font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600">Report Card Generator</div>
                <div className="text-xs text-slate-500 mt-1">Auto-synthesize pastoral student comments compliant with QCAA A-E reporting.</div>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ----------------------------------------------------
  // 🌟 SUPER ADMIN UNIFIED CONSOLE (When roleFilter === 'all')
  // ----------------------------------------------------
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page space-y-6">
      {/* Top Banner with Filter Bar */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Shield size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Super Admin Command Center</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase">
                  Global View
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Filter and manage features segregated specifically across Teachers, Students, and Institute Management.
              </p>
            </div>
          </div>

          <RoleFilterBar />
        </div>
      </div>

      {/* 🚀 SUPER ADMIN MASTER GOVERNANCE & TELEMETRY SUITE */}
      <div className="card shadow-xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white/90 dark:from-zinc-900/90 dark:via-zinc-900/80 dark:to-amber-950/20 backdrop-blur-3xl rounded-3xl p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 uppercase tracking-wider">
              <Shield size={14} className="text-amber-600 dark:text-amber-400" />
              <span>Multi-Tenant Infrastructure Hub</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Institute Onboarding, Quotas & AI Usage Telemetry
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Provision new pilot institutions with 7-30 day trial bounds, monitor real-time teacher and student enrollments against allocated quotas, and track high-resolution AI token consumption and request throughput across all schools.
            </p>
            
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-sm">
                <Building2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span>Onboard & Manage Institutes</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-sm">
                <Users size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Teacher & Student Headcounts</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-sm">
                <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
                <span>Token Telemetry & AI Limits</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <Link
              to="/superadmin"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 hover:shadow-xl hover:scale-[1.02] transition-all"
            >
              <Shield size={18} />
              <span>Launch Super Admin Hub</span>
            </Link>
            <Link
              to="/superadmin/dashboard"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 text-xs font-bold shadow-sm transition-all"
            >
              <Building2 size={16} className="text-indigo-600" />
              <span>Onboard Institute & Trials</span>
            </Link>
          </div>
        </div>
      </div>

      {/* SEGREGATED SUITES - ALL 3 GROUPS */}
      
      {/* GROUP 1: TEACHER FEATURES */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              <GraduationCap size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">1. Teacher Features</h2>
              <span className="text-[11px] text-slate-500">Curriculum planning, rubrics, worksheets, assessments & leveling</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            6 Core Tools
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link to="/educator/lesson-planner" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-400 transition-all flex items-center gap-3">
            <BookOpen size={16} className="text-blue-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(a) Lesson Planner</div>
              <div className="text-[10px] text-slate-400">ACARA v9.0 outcomes & differentiation</div>
            </div>
          </Link>

          <Link to="/educator/rubric-generator" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-400 transition-all flex items-center gap-3">
            <ClipboardList size={16} className="text-teal-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(b) Rubric Generator</div>
              <div className="text-[10px] text-slate-400">QCAA ISMG criteria & cognitive verbs</div>
            </div>
          </Link>

          <Link to="/educator/worksheet-generator" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-400 transition-all flex items-center gap-3">
            <FileSpreadsheet size={16} className="text-orange-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(c) Worksheet Generator</div>
              <div className="text-[10px] text-slate-400">Printable student sheets with answer keys</div>
            </div>
          </Link>

          <Link to="/educator/assessment-generator" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-400 transition-all flex items-center gap-3">
            <CheckSquare size={16} className="text-indigo-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(d) Assessment & Quiz Gen</div>
              <div className="text-[10px] text-slate-400">NAPLAN tests with automated scoring</div>
            </div>
          </Link>

          <Link to="/educator/custom-bots" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-400 transition-all flex items-center gap-3">
            <Sparkles size={16} className="text-purple-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(e) Custom Chat Bot</div>
              <div className="text-[10px] text-slate-400">Persona & Socratic strictness studio</div>
            </div>
          </Link>

          <Link to="/educator/leveler" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-400 transition-all flex items-center gap-3">
            <Scissors size={16} className="text-cyan-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(f) Text Leveler</div>
              <div className="text-[10px] text-slate-400">Prep to Year 5 Lexile differentiation</div>
            </div>
          </Link>
        </div>
      </div>

      {/* GROUP 2: STUDENT FEATURES */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              <Backpack size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">2. Student Features</h2>
              <span className="text-[11px] text-slate-500">Socratic guidance, reading support, quizzes & test taking</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            5 Core Tools
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link to="/socratic-tutor" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-emerald-400 transition-all flex items-center gap-3">
            <Sparkles size={16} className="text-blue-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(a) Socratic Sandbox AI</div>
              <div className="text-[10px] text-slate-400">Real-time Socratic guiding dialogue</div>
            </div>
          </Link>

          <Link to="/student/text-leveler" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-emerald-400 transition-all flex items-center gap-3">
            <Scissors size={16} className="text-cyan-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(b) Text Leveler (Student)</div>
              <div className="text-[10px] text-slate-400">Simplify difficult text with audio reading</div>
            </div>
          </Link>

          <Link to="/student/join-room" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-emerald-400 transition-all flex items-center gap-3">
            <Bot size={16} className="text-amber-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(c) Join Chatbot Room</div>
              <div className="text-[10px] text-slate-400">Connect to teacher-created classroom chatbot rooms</div>
            </div>
          </Link>

          <Link to="/student/writing-studio" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-emerald-400 transition-all flex items-center gap-3">
            <PenTool size={16} className="text-indigo-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(d) Writing Studio</div>
              <div className="text-[10px] text-slate-400">Targeted grammar and cohesion feedback</div>
            </div>
          </Link>

          <Link to="/student/test-environment" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-emerald-400 transition-all flex items-center gap-3">
            <CheckSquare size={16} className="text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(e) Test Environment</div>
              <div className="text-[10px] text-slate-400">Take exams with automated QCAA grading</div>
            </div>
          </Link>
        </div>
      </div>

      {/* GROUP 3: INSTITUTE MANAGEMENT FEATURES */}
      <div className="card shadow-lg border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
              <Building2 size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">3. Institute Management</h2>
              <span className="text-[11px] text-slate-500">Knowledge RAG, teacher/student governance & reporting</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            4 Core Modules
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/admin/rag-ingestion" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-purple-400 transition-all flex items-center gap-3">
            <Database size={16} className="text-purple-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(a) RAG Ingestion & Base</div>
              <div className="text-[10px] text-slate-400">Vectorize district curriculum PDFs</div>
            </div>
          </Link>

          <Link to="/admin/teachers" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-purple-400 transition-all flex items-center gap-3">
            <GraduationCap size={16} className="text-blue-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(b) Teacher Management</div>
              <div className="text-[10px] text-slate-400">Onboard, tool permissions & limits</div>
            </div>
          </Link>

          <Link to="/admin/students" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-purple-400 transition-all flex items-center gap-3">
            <Backpack size={16} className="text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(c) Student Management</div>
              <div className="text-[10px] text-slate-400">Rosters, safety locks & AI quotas</div>
            </div>
          </Link>

          <Link to="/admin/report-card" className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-purple-400 transition-all flex items-center gap-3">
            <ClipboardList size={16} className="text-indigo-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">(d) Report Card Gen</div>
              <div className="text-[10px] text-slate-400">Synthesize QCAA pastoral comments</div>
            </div>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default Dashboard;
