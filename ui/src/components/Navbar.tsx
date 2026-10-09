import { Link } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { useRoleFilter } from '../services/roleFilterContext'
import { motion } from 'framer-motion'
import { LogOut, Shield } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
export function Navbar() {
  const { status, me, logout } = useAuth()
  const { isSuperAdmin } = useRoleFilter()

  return (
    <div className="sticky top-0 z-50 mx-2 sm:mx-4 my-2 sm:my-3 rounded-2xl sm:rounded-[2rem] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-glass-dark">
      <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-4">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <Link to="/" className="flex items-center gap-2 sm:gap-3 font-serif font-bold text-base sm:text-lg text-blue-900 dark:text-blue-100">
            <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/75 dark:bg-zinc-800/50 shadow-sm border border-blue-900/10 dark:border-white/[0.04] shrink-0">
              <img className="w-5 h-5 sm:w-6 sm:h-6 object-contain" src="/main-logo.png" alt="SafeScholar" />
            </span>
            <span className="hidden sm:inline">SafeScholar</span>
          </Link>
        </motion.div>

        {/* Public Navigation Shortcuts */}
        <div className="hidden lg:flex items-center gap-5 ml-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <a href="/#interactive-demo" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Live Demo
          </a>
          <Link to="/login?mode=register&role=teacher" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            For Educators
          </Link>
          <Link to="/login?mode=register&role=student" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            For Students
          </Link>
          <Link to="/login?mode=register&role=institute_management" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            School Districts
          </Link>
        </div>

        {isSuperAdmin && (
          <Link
            to="/superadmin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all shrink-0 ml-2"
            title="Open Super Admin Enterprise Console (Resilience Mesh, Roles, Trials)"
          >
            <Shield size={14} />
            <span className="hidden sm:inline">Super Admin Console</span>
          </Link>
        )}

        <div className="flex-1" />

        <ThemeToggle />

        {status === 'authenticated' ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shrink-0"
            >
              <span>Dashboard</span>
            </Link>

            <Link
              to="/profile"
              className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-blue-900/15 dark:border-white/[0.08] bg-white/75 dark:bg-zinc-800/60 hover:bg-blue-50/80 dark:hover:bg-zinc-800 transition-all shadow-sm hover:shadow hover:border-blue-500/30 group"
              title="View and manage your account profile"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-inner shrink-0">
                {((me?.firstName?.[0] || '') + (me?.lastName?.[0] || '')).toUpperCase() || (me?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="flex flex-col text-left leading-tight">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[110px] sm:max-w-[160px]">
                  {[me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.email?.split('@')[0] || 'My Profile'}
                </div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-400 truncate max-w-[110px] sm:max-w-[160px]">
                  {me?.isSysAdmin ? 'Super Admin' : (me?.roles?.[0] || 'Member')}
                </div>
              </div>
            </Link>

            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-blue-900 to-blue-800 dark:from-blue-700 dark:to-blue-900 text-white shadow-md hover:shadow-lg transition-shadow shrink-0" 
              onClick={() => void logout()} 
              aria-label="Logout"
            >
              <LogOut size={15} className="sm:w-[16px] sm:h-[16px]" />
            </motion.button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-blue-900/15 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-blue-50/60 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap"
            >
              Sign In
            </Link>
            <Link
              to="/login?mode=register"
              className="flex items-center justify-center px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
            >
              Get Started Free
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
