import React from 'react';
import { NavLink } from 'react-router-dom';
import { useRoleFilter } from '../services/roleFilterContext';
import { 
  LayoutGrid, BookOpen, FileText, FileSpreadsheet, 
  ClipboardCheck, Sparkles, Scissors, PenTool, 
  Lightbulb, CheckCircle2, Database, 
  GraduationCap, Backpack, Building2, Shield
} from 'lucide-react';
import { motion } from 'framer-motion';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
}

// 1. Teacher Routes (Exact 6 features requested)
const teacherRoutes: NavItem[] = [
  { label: 'Lesson Planner', path: '/educator/lesson-planner', icon: BookOpen },
  { label: 'Rubric Generator', path: '/educator/rubric-generator', icon: FileText },
  { label: 'Worksheet Generator', path: '/educator/worksheet-generator', icon: FileSpreadsheet },
  { label: 'Assessment & Quizzes', path: '/educator/assessment-generator', icon: ClipboardCheck },
  { label: 'Custom Chat Bot', path: '/educator/custom-bots', icon: Sparkles },
  { label: 'Text Leveler', path: '/educator/leveler', icon: Scissors },
];

// 2. Student Routes (Exact 5 features requested)
const studentRoutes: NavItem[] = [
  { label: 'Socratic Sandbox', path: '/socratic-tutor', icon: Sparkles },
  { label: 'Reading Leveler', path: '/student/text-leveler', icon: Scissors },
  { label: 'AI Quiz Me', path: '/student/quiz-me', icon: Lightbulb },
  { label: 'Writing Studio', path: '/student/writing-studio', icon: PenTool },
  { label: 'Test Environment', path: '/student/test-environment', icon: CheckCircle2 },
];

// 3. Institute Management Routes (Exact 4 features requested)
const instituteRoutes: NavItem[] = [
  { label: 'RAG Ingestion & Base', path: '/admin/rag-ingestion', icon: Database },
  { label: 'Teacher Management', path: '/admin/teachers', icon: GraduationCap },
  { label: 'Student Management', path: '/admin/students', icon: Backpack },
  { label: 'Report Card Gen', path: '/admin/report-card', icon: FileText },
];

export function Sidebar() {
  const { roleFilter, isSuperAdmin, effectiveRole } = useRoleFilter();

  const showTeacher = isSuperAdmin ? (roleFilter === 'all' || roleFilter === 'teacher') : (effectiveRole === 'teacher' || effectiveRole === 'all');
  const showStudent = isSuperAdmin ? (roleFilter === 'all' || roleFilter === 'student') : (effectiveRole === 'student' || effectiveRole === 'all');
  const showInstitute = isSuperAdmin ? (roleFilter === 'all' || roleFilter === 'institute') : (effectiveRole === 'institute' || effectiveRole === 'all');

  return (
    <aside className="fixed md:relative bottom-3 sm:bottom-4 md:bottom-auto inset-x-2 sm:inset-x-4 md:inset-x-auto z-50 md:z-40 w-auto md:w-64 shrink-0 bg-white/85 md:bg-white/70 dark:bg-zinc-900/85 md:dark:bg-zinc-900/60 backdrop-blur-3xl md:backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/60 dark:border-white/[0.06] rounded-3xl md:rounded-[2rem] shadow-2xl md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:dark:shadow-glass-dark p-1.5 sm:p-2 md:p-4 flex flex-col">
      <div className="flex flex-row md:flex-col gap-1 sm:gap-2 relative overflow-x-auto md:overflow-visible scrollbar-hide snap-x items-center md:items-stretch" style={{ WebkitOverflowScrolling: 'touch' }}>
        
        <SidebarLink to="/dashboard" icon={LayoutGrid} label="Dashboard" />

        {/* SUPER ADMIN SECTION */}
        {isSuperAdmin && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-2 pb-1.5 md:border-b md:border-slate-200/60 md:dark:border-white/10">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/40 rounded-lg">
              <Shield size={13} />
              <span>Super Admin</span>
            </div>
            <SidebarLink to="/superadmin" icon={Shield} label="Super Admin Hub" />
          </div>
        )}

        {/* TEACHER SECTION */}
        {showTeacher && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg">
              <GraduationCap size={13} />
              <span>Teachers</span>
            </div>
            {teacherRoutes.map((route) => (
              <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} />
            ))}
          </div>
        )}

        {/* STUDENT SECTION */}
        {showStudent && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-3">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg">
              <Backpack size={13} />
              <span>Students</span>
            </div>
            {studentRoutes.map((route) => (
              <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} />
            ))}
          </div>
        )}

        {/* INSTITUTE MANAGEMENT SECTION */}
        {showInstitute && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-3">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/30 rounded-lg">
              <Building2 size={13} />
              <span>Institute Mgmt</span>
            </div>
            {instituteRoutes.map((route) => (
              <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} />
            ))}
          </div>
        )}

      </div>
    </aside>
  );
}

function SidebarLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `relative flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-3 sm:px-4 py-2.5 md:py-2.5 rounded-2xl md:rounded-full text-[10px] sm:text-xs md:text-sm font-medium transition-colors z-10 shrink-0 w-[4.5rem] sm:w-[5.5rem] md:w-auto snap-center md:snap-align-none ${
        isActive 
          ? 'text-blue-700 dark:text-blue-300 font-bold' 
          : 'text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="sidebar-active-indicator"
              className="absolute inset-0 bg-blue-100/70 dark:bg-blue-500/15 dark:border dark:border-blue-500/25 rounded-2xl md:rounded-full -z-10 shadow-sm"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <Icon size={18} className="md:w-[17px] md:h-[17px] shrink-0" strokeWidth={isActive ? 2.5 : 2} />
          <span className="truncate w-full text-center md:text-left">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default Sidebar;
