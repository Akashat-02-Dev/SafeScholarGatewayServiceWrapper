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
          <Link to="/dashboard" className="flex items-center gap-2 sm:gap-3 font-serif font-bold text-base sm:text-lg text-blue-900 dark:text-blue-100">
            <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/75 dark:bg-zinc-800/50 shadow-sm border border-blue-900/10 dark:border-white/[0.04] shrink-0">
              <img className="w-5 h-5 sm:w-6 sm:h-6 object-contain" src="/main-logo.png" alt="SafeScholar" />
            </span>
            <span className="hidden sm:inline">SafeScholar</span>
          </Link>
        </motion.div>


        {isSuperAdmin && (
          <Link
            to="/superadmin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all shrink-0"
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
          <Link to="/login" className="flex items-center justify-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-b from-blue-900 to-blue-800 text-white text-sm sm:text-base font-medium shadow-md hover:shadow-lg transition-shadow whitespace-nowrap shrink-0">
            Sign in
          </Link>
        )}
      </div>
    </div>
  )
}
