import { Link } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { motion } from 'framer-motion'
import { LogOut, UserRound } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const { status, me, logout } = useAuth()

  return (
    <div className="sticky top-0 z-50 m-4 rounded-[2rem] bg-white/60 dark:bg-zinc-900/40 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-glass-dark">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <Link to="/dashboard" className="flex items-center gap-2 sm:gap-3 font-serif font-bold text-base sm:text-lg text-blue-900 dark:text-blue-100">
            <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/75 dark:bg-zinc-800/50 shadow-sm border border-blue-900/10 dark:border-white/[0.04] shrink-0">
              <img className="w-5 h-5 sm:w-6 sm:h-6 object-contain" src="/main-logo.png" alt="SafeScholar" />
            </span>
            <span className="hidden sm:inline">SafeScholar</span>
          </Link>
        </motion.div>

        <div className="flex-1" />

        <ThemeToggle />

        {status === 'authenticated' ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-blue-900/10 dark:border-white/[0.04] bg-white/65 dark:bg-zinc-800/40 shadow-sm">
              <UserRound size={16} className="text-blue-900/80 dark:text-blue-100/80" />
              <div className="text-xs font-semibold text-blue-900/90 dark:text-blue-100/90">{me?.email}</div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-b from-blue-900 to-blue-800 dark:from-blue-700 dark:to-blue-900 text-white shadow-md hover:shadow-lg transition-shadow shrink-0" 
              onClick={() => void logout()} 
              aria-label="Logout"
            >
              <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
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
