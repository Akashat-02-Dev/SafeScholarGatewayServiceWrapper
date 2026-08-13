import { NavLink } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { 
  LayoutGrid, ShieldCheck, Users, Wrench, Sparkles, 
  BookOpen, Scissors, Video, FileText, Database,
  Building2, Shield, PenTool, MessageCircle, Lightbulb
} from 'lucide-react'
import { motion } from 'framer-motion'

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<any>
  permission: string
}

const teacherRoutes: NavItem[] = [
  { label: 'Lesson Planner', path: '/ai/lesson-planner', icon: BookOpen, permission: 'GENERATE_LESSON_PLAN' },
  { label: 'Text Leveler', path: '/ai/leveler', icon: Scissors, permission: 'USE_TEXT_LEVELER' },
  { label: 'YouTube Assessor', path: '/ai/video-assessor', icon: Video, permission: 'USE_VIDEO_ASSESSOR' },
  { label: 'IEP & Rubrics', path: '/ai/iep-generator', icon: FileText, permission: 'GENERATE_IEP_RUBRIC' },
  { label: 'Custom Bot Studio', path: '/ai/bot-studio', icon: Sparkles, permission: 'GENERATE_LESSON_PLAN' },
  { label: 'Student Oversight', path: '/ai/student-oversight', icon: ShieldCheck, permission: 'GENERATE_LESSON_PLAN' },
]

const studentRoutes: NavItem[] = [
  { label: 'Socratic Sandbox', path: '/socratic-tutor', icon: Sparkles, permission: 'EXECUTE_AI_TUTOR' },
  { label: 'Writing Studio', path: '/student/writing-studio', icon: PenTool, permission: 'EXECUTE_AI_TUTOR' },
  { label: 'Character Chat Hub', path: '/student/chat-hub', icon: MessageCircle, permission: 'EXECUTE_AI_TUTOR' },
  { label: 'AI Quiz Me!', path: '/student/quiz-me', icon: Lightbulb, permission: 'EXECUTE_AI_TUTOR' },
]

export function Sidebar() {
  const { hasPermission } = useAuth()

  return (
    <>
      {/* Mobile Dock / Desktop Sidebar */}
      <div className="fixed md:relative bottom-4 md:bottom-auto inset-x-4 md:inset-x-auto z-50 md:z-40 w-auto md:w-64 shrink-0 bg-white/70 md:bg-white/60 dark:bg-zinc-900/70 md:dark:bg-zinc-900/60 backdrop-blur-3xl md:backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/10 rounded-3xl md:rounded-[2rem] shadow-2xl md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-2 md:p-4 flex flex-col">
        <div className="flex flex-row md:flex-col gap-1 sm:gap-2 relative overflow-x-auto md:overflow-visible scrollbar-hide snap-x items-center md:items-stretch" style={{ WebkitOverflowScrolling: 'touch' }}>
          <SidebarLink to="/dashboard" icon={LayoutGrid} label="Dashboard" />
          
          {teacherRoutes.map((route) => (
            hasPermission(route.permission) && 
            <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} />
          ))}
          
          {studentRoutes.map((route) => (
            hasPermission(route.permission) && 
            <SidebarLink key={route.path} to={route.path} icon={route.icon} label={route.label} />
          ))}
          
          {hasPermission('MANAGE_GLOBAL_TENANTS') && (
            <SidebarLink to="/superadmin/dashboard" icon={Shield} label="Super Admin" />
          )}
          
          {hasPermission('MANAGE_LOCAL_ROLES') && (
            <SidebarLink to="/admin/dashboard" icon={Building2} label="District" />
          )}
          
          {hasPermission('MANAGE_DISTRICT_AI_KNOWLEDGE') && (
            <SidebarLink to="/rag-ingestion" icon={Database} label="RAG Ingestion" />
          )}
          
          {hasPermission('MANAGE_USERS') && (
            <SidebarLink to="/user-management" icon={Users} label="Users" />
          )}
          
          {hasPermission('MANAGE_ROLES') && (
            <SidebarLink to="/role-management" icon={Wrench} label="Roles" />
          )}
          
          {hasPermission('MODERATE_CONTENT') && (
            <SidebarLink to="/moderation" icon={ShieldCheck} label="Moderation" />
          )}
        </div>
      </div>
      
      {/* Mobile Spacer so content isn't hidden behind the dock */}
      <div className="block md:hidden h-24 shrink-0 w-full"></div>
    </>
  )
}

function SidebarLink({ to, icon: Icon, label }: { to: string, icon: any, label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `relative flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-3 sm:px-4 py-2.5 md:py-3 rounded-2xl md:rounded-full text-[10px] sm:text-xs md:text-sm font-medium md:font-medium transition-colors z-10 shrink-0 w-[4.5rem] sm:w-[5.5rem] md:w-auto snap-center md:snap-align-none ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="sidebar-active-indicator"
              className="absolute inset-0 bg-blue-100/60 dark:bg-blue-900/40 rounded-2xl md:rounded-full -z-10 shadow-sm md:shadow-none"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
          <Icon size={20} className="md:w-[18px] md:h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
          <span className="truncate w-full text-center md:text-left">{label}</span>
        </>
      )}
    </NavLink>
  )
}
