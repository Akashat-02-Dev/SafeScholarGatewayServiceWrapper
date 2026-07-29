import { NavLink } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { 
  LayoutGrid, ShieldCheck, Users, Wrench, Sparkles, 
  BookOpen, Scissors, Video, FileText, Database,
  Building2, Shield
} from 'lucide-react'

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
]

export function Sidebar() {
  const { hasPermission } = useAuth()

  return (
    <div className="card">
      <div className="sideNav">
        {/* Core Dashboard always visible */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
        >
          <LayoutGrid size={18} />
          Dashboard
        </NavLink>

        {/* Dynamic Teacher AI Workspace Tools */}
        {teacherRoutes.map((route) => {
          if (!hasPermission(route.permission)) return null
          
          return (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
            >
              <route.icon size={18} />
              {route.label}
            </NavLink>
          )
        })}

        {/* Student Sandbox */}
        {hasPermission('EXECUTE_AI_TUTOR') ? (
          <NavLink
            to="/socratic-tutor"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Sparkles size={18} />
            Socratic Sandbox
          </NavLink>
        ) : null}

        {/* Super Admin Console */}
        {hasPermission('MANAGE_GLOBAL_TENANTS') ? (
          <NavLink
            to="/superadmin/dashboard"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Shield size={18} />
            Super Admin Console
          </NavLink>
        ) : null}

        {/* District Operator Dashboard */}
        {hasPermission('MANAGE_LOCAL_ROLES') ? (
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Building2 size={18} />
            District Operator
          </NavLink>
        ) : null}

        {/* Administration & System controls */}
        {hasPermission('MANAGE_DISTRICT_AI_KNOWLEDGE') ? (
          <NavLink
            to="/rag-ingestion"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Database size={18} />
            RAG Ingestion
          </NavLink>
        ) : null}

        {hasPermission('MANAGE_USERS') ? (
          <NavLink
            to="/user-management"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Users size={18} />
            User Management
          </NavLink>
        ) : null}

        {hasPermission('MANAGE_ROLES') ? (
          <NavLink
            to="/role-management"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Wrench size={18} />
            Role Management
          </NavLink>
        ) : null}

        {hasPermission('MODERATE_CONTENT') ? (
          <NavLink
            to="/moderation"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <ShieldCheck size={18} />
            Moderation Panel
          </NavLink>
        ) : null}
      </div>
    </div>
  )
}
