import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useRoleFilter } from '../services/roleFilterContext';
import { 
  LayoutGrid, BookOpen, FileText, FileSpreadsheet, 
  ClipboardCheck, Sparkles, Scissors, PenTool, 
  Bot, CheckCircle2, Database, 
  GraduationCap, Backpack, Building2, Shield,
  Cpu, KeyRound
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
  { label: 'Join Chatbot Room', path: '/student/join-room', icon: Bot },
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
    <aside className="fixed md:relative bottom-3 sm:bottom-4 md:bottom-auto inset-x-2 sm:inset-x-4 md:inset-x-auto z-50 md:z-40 w-auto md:w-64 shrink-0 bg-white/85 md:bg-white/75 dark:bg-zinc-900/85 md:dark:bg-zinc-900/70 backdrop-blur-3xl md:backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-slate-200/80 dark:border-white/[0.08] rounded-3xl md:rounded-[2rem] shadow-2xl md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:dark:shadow-glass-dark p-1.5 sm:p-2 md:p-4 flex flex-col">
      <div className="flex flex-row md:flex-col gap-1 sm:gap-2 relative overflow-x-auto md:overflow-visible scrollbar-hide snap-x items-center md:items-stretch" style={{ WebkitOverflowScrolling: 'touch' }}>
        
        <SidebarLink to="/dashboard" icon={LayoutGrid} label="Dashboard" roleDomain={effectiveRole === 'all' ? 'default' : effectiveRole} />

        {/* SUPER ADMIN SECTION */}
        {isSuperAdmin && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-2 pb-1.5 md:border-b md:border-slate-200/60 md:dark:border-white/10">
            <div className="hidden md:flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Shield size={12} className="text-amber-600 dark:text-amber-400" />
                <span>Super Admin</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <SidebarLink to="/superadmin?tab=plugins" icon={Cpu} label="Resilience Mesh" roleDomain="superadmin" />
            <SidebarLink to="/superadmin?tab=rbac" icon={KeyRound} label="Roles & Perms" roleDomain="superadmin" />
            <SidebarLink to="/superadmin?tab=infrastructure" icon={Building2} label="Institutes & Trials" roleDomain="superadmin" />
          </div>
        )}

        {/* TEACHER SECTION (BLUE THEME) */}
        {showTeacher && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-2">
            <div className="hidden md:flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <GraduationCap size={13} className="text-blue-600 dark:text-blue-400" />
                <span>Teachers</span>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                BLUE
              </span>
            </div>
            {teacherRoutes.map((route) => (
              <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} roleDomain="teacher" />
            ))}
          </div>
        )}

        {/* STUDENT SECTION (GREEN THEME) */}
        {showStudent && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-3">
            <div className="hidden md:flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Backpack size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>Students</span>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                GREEN
              </span>
            </div>
            {studentRoutes.map((route) => (
              <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} roleDomain="student" />
            ))}
          </div>
        )}

        {/* INSTITUTE MANAGEMENT SECTION (VIOLET/PINK THEME) */}
        {showInstitute && (
          <div className="flex flex-row md:flex-col gap-1 sm:gap-1.5 md:mt-3">
            <div className="hidden md:flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-pink-300 bg-purple-100/70 dark:bg-purple-950/50 border border-purple-200/70 dark:border-pink-800/50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Building2 size={13} className="text-purple-600 dark:text-pink-400" />
                <span>Institute Mgmt</span>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-200/60 dark:bg-purple-900/60 text-purple-800 dark:text-pink-200">
                VIOLET
              </span>
            </div>
            {instituteRoutes.map((route) => (
              <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} roleDomain="institute" />
            ))}
          </div>
        )}

      </div>
    </aside>
  );
}

function SidebarLink({ 
  to, 
  icon: Icon, 
  label,
  roleDomain = 'default'
}: { 
  to: string; 
  icon: any; 
  label: string;
  roleDomain?: 'teacher' | 'student' | 'institute' | 'superadmin' | 'default';
}) {
  const location = useLocation();
  const currentPathWithSearch = location.pathname + location.search;
  
  // Exact or query matching
  let isMatch = false;
  if (to.includes('?')) {
    isMatch = currentPathWithSearch === to;
  } else {
    if (to === '/superadmin') {
      isMatch = location.pathname === '/superadmin' && !location.search;
    } else {
      isMatch = location.pathname === to;
    }
  }

  // Domain styling maps
  const styles = {
    teacher: {
      activeText: 'text-blue-700 dark:text-blue-300 font-bold',
      activeIndicator: 'bg-blue-100/90 dark:bg-blue-500/20 border border-blue-300/80 dark:border-blue-500/40 shadow-sm shadow-blue-500/10',
      hover: 'hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/30',
      dot: 'bg-blue-500',
    },
    student: {
      activeText: 'text-emerald-700 dark:text-emerald-300 font-bold',
      activeIndicator: 'bg-emerald-100/90 dark:bg-emerald-500/20 border border-emerald-300/80 dark:border-emerald-500/40 shadow-sm shadow-emerald-500/10',
      hover: 'hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30',
      dot: 'bg-emerald-500',
    },
    institute: {
      activeText: 'text-purple-700 dark:text-pink-300 font-bold',
      activeIndicator: 'bg-purple-100/90 dark:bg-purple-500/20 border border-purple-300/80 dark:border-pink-500/40 shadow-sm shadow-purple-500/10',
      hover: 'hover:text-purple-700 dark:hover:text-pink-300 hover:bg-purple-50/70 dark:hover:bg-purple-950/30',
      dot: 'bg-fuchsia-500',
    },
    superadmin: {
      activeText: 'text-amber-800 dark:text-amber-300 font-bold',
      activeIndicator: 'bg-amber-100/90 dark:bg-amber-500/20 border border-amber-300/80 dark:border-amber-500/40 shadow-sm shadow-amber-500/10',
      hover: 'hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50/70 dark:hover:bg-amber-950/30',
      dot: 'bg-amber-500',
    },
    default: {
      activeText: 'text-slate-900 dark:text-white font-bold',
      activeIndicator: 'bg-slate-200/80 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 shadow-sm',
      hover: 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60',
      dot: 'bg-slate-500',
    },
  };

  const domainStyle = styles[roleDomain] || styles.default;

  return (
    <Link
      to={to}
      className={`relative flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-3 sm:px-4 py-2.5 md:py-2.5 rounded-2xl md:rounded-full text-[10px] sm:text-xs md:text-sm font-medium transition-colors z-10 shrink-0 w-[4.5rem] sm:w-[5.5rem] md:w-auto snap-center md:snap-align-none ${
        isMatch 
          ? domainStyle.activeText 
          : `text-slate-600 dark:text-zinc-400 ${domainStyle.hover}`
      }`}
    >
      {isMatch && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className={`absolute inset-0 rounded-2xl md:rounded-full -z-10 ${domainStyle.activeIndicator}`}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
      <Icon size={18} className="md:w-[17px] md:h-[17px] shrink-0" strokeWidth={isMatch ? 2.5 : 2} />
      <span className="truncate w-full text-center md:text-left">{label}</span>
      {isMatch && (
        <span className={`hidden md:block w-1.5 h-1.5 rounded-full ${domainStyle.dot} ml-auto shrink-0`} />
      )}
    </Link>
  );
}

export default Sidebar;
