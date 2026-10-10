import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { useRoleFilter } from '../services/roleFilterContext'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LogOut, Shield, ChevronDown, Menu, X, ArrowRight, 
  Sparkles, BookOpen, Laptop, School, CheckCircle2, 
  Award, FileText, MessageSquare, ShieldCheck, Compass, GraduationCap
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const { status, me, logout } = useAuth()
  const { isSuperAdmin } = useRoleFilter()
  const location = useLocation()

  // Navigation states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const [platformOpen, setPlatformOpen] = useState(false)

  const solutionsRef = useRef<HTMLDivElement>(null)
  const platformRef = useRef<HTMLDivElement>(null)

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setSolutionsOpen(false)
    setPlatformOpen(false)
  }, [location.pathname, location.search])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (solutionsRef.current && !solutionsRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false)
      }
      if (platformRef.current && !platformRef.current.contains(event.target as Node)) {
        setPlatformOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const platformEngines = [
    {
      title: 'Lesson Sequences',
      badge: 'ACARA V9',
      desc: 'Sequential unit planning with WALT & WILF criteria',
      to: status === 'authenticated' ? '/educator/lesson-planner' : '/login?mode=register&role=teacher',
      icon: BookOpen,
      iconBg: 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50',
      hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    },
    {
      title: 'Rubric Matrix',
      badge: '4-Tier',
      desc: 'Standards-based achievement level descriptors & grading',
      to: status === 'authenticated' ? '/educator/rubric-generator' : '/login?mode=register&role=teacher',
      icon: Award,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/50',
      hoverText: 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400',
    },
    {
      title: 'Worksheets Studio',
      badge: '3-Tier',
      desc: 'Scaffolded tasks for support, core & extension bands',
      to: status === 'authenticated' ? '/educator/worksheet-generator' : '/login?mode=register&role=teacher',
      icon: FileText,
      iconBg: 'bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-900/50',
      hoverText: 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
    },
    {
      title: 'Socratic Sandbox',
      badge: 'Anti-Cheating',
      desc: 'Guided Socratic inquiry preventing direct answer copy-paste',
      to: status === 'authenticated' ? '/socratic-tutor' : '/login?mode=register&role=student',
      icon: MessageSquare,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50',
      hoverText: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    },
    {
      title: 'Lexile Text Leveler',
      badge: 'Prep-Yr 12',
      desc: 'Transform passage complexity to match student reading levels',
      to: status === 'authenticated' ? '/educator/leveler' : '/login?mode=register&role=teacher',
      icon: Compass,
      iconBg: 'bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-900/50',
      hoverText: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
    },
    {
      title: 'Real-Time Moderation',
      badge: 'Zero-PII',
      desc: 'Automated student safety guardrails, PII redaction & audits',
      to: status === 'authenticated' ? (isSuperAdmin ? '/superadmin' : '/admin/moderation') : '/login?mode=register&role=institute_management',
      icon: ShieldCheck,
      iconBg: 'bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50',
      hoverText: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
    },
  ]

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl -webkit-backdrop-filter border-b border-slate-200/80 dark:border-white/[0.08] transition-all">
      <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Enterprise Badge */}
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none"
            aria-label="SafeScholar Home"
          >
            <img 
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain group-hover:scale-105 transition-transform duration-200 shrink-0" 
              src="/main-logo.png" 
              alt="SafeScholar Logo" 
            />
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                  SafeScholar
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Shield size={10} className="text-blue-600 dark:text-blue-400" />
                  Enterprise AI
                </span>
              </div>
              <span className="hidden md:inline text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 tracking-wide">
                Curriculum & Student Safety Mesh
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          {/* Solutions Dropdown */}
          <div className="relative" ref={solutionsRef}>
            <button
              type="button"
              onClick={() => {
                setSolutionsOpen(!solutionsOpen)
                setPlatformOpen(false)
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all ${
                solutionsOpen 
                  ? 'bg-slate-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-bold' 
                  : 'hover:bg-slate-100/70 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span>Solutions</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${solutionsOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {solutionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full left-0 mt-2 w-80 p-3 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800 shadow-2xl z-50 space-y-1"
                >
                  <Link
                    to={status === 'authenticated' ? '/educator/lesson-planner' : '/login?mode=register&role=teacher'}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <GraduationCap size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        For Educators & Faculty
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        ACARA lesson sequences, rubrics, tiered worksheets & Lexile transformers.
                      </div>
                    </div>
                  </Link>

                  <Link
                    to={status === 'authenticated' ? '/socratic-tutor' : '/login?mode=register&role=student'}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Laptop size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        For Students & Learners
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        Guided Socratic AI tutor, NAPLAN writing studio & supervised rooms.
                      </div>
                    </div>
                  </Link>

                  <Link
                    to={status === 'authenticated' ? (isSuperAdmin ? '/superadmin' : '/admin/dashboard') : '/login?mode=register&role=institute_management'}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <School size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                        For School Districts & IT
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                        Multi-tenant boundaries, signup gatekeeping & automated content moderation.
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Platform Engines Dropdown */}
          <div className="relative" ref={platformRef}>
            <button
              type="button"
              onClick={() => {
                setPlatformOpen(!platformOpen)
                setSolutionsOpen(false)
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all ${
                platformOpen 
                  ? 'bg-slate-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-bold' 
                  : 'hover:bg-slate-100/70 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span>Platform</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${platformOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {platformOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full left-0 mt-2 w-[540px] xl:w-[580px] p-3.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800 shadow-2xl z-50"
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between px-2 pb-2.5 mb-2 border-b border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Curriculum & Safety Engines
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/50">
                      6 Core Tools
                    </span>
                  </div>

                  {/* 2-Column Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {platformEngines.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.title}
                          to={item.to}
                          onClick={() => setPlatformOpen(false)}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-zinc-800/70 border border-transparent hover:border-slate-200/70 dark:hover:border-zinc-700/60 transition-all group"
                        >
                          <div className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm transition-transform group-hover:scale-105`}>
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`font-bold text-slate-900 dark:text-white text-xs ${item.hoverText} transition-colors truncate`}>
                                {item.title}
                              </span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 shrink-0">
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5 line-clamp-2 font-normal">
                              {item.desc}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  {/* Footer Strip */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between px-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      <span>Mapped to ACARA V9 Australian Standards</span>
                    </div>
                    <a
                      href="/#interactive-demo"
                      onClick={() => setPlatformOpen(false)}
                      className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/demo"
                    >
                      <span>Live Interactive Demo</span>
                      <ArrowRight size={11} className="group-hover/demo:translate-x-0.5 transition-transform" />
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Interactive Demo Link */}
          <a
            href="/#interactive-demo"
            className="px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-zinc-800/60 transition-colors flex items-center gap-1.5"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>Live Demo</span>
          </a>

          {/* Super Admin Console Indicator if applicable */}
          {isSuperAdmin && (
            <Link
              to="/superadmin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Shield size={13} />
              <span>Super Admin</span>
            </Link>
          )}
        </nav>

        {/* Right Action Bar: System Status, Theme Toggle & Auth Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Operational Status Pill */}
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Systems Operational</span>
          </div>

          <ThemeToggle />

          {status === 'authenticated' ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all shrink-0"
              >
                <span>Dashboard</span>
                <ArrowRight size={13} />
              </Link>

              <Link
                to="/profile"
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-sm group"
                title="View your account profile"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px] sm:text-xs shrink-0">
                  {((me?.firstName?.[0] || '') + (me?.lastName?.[0] || '')).toUpperCase() || (me?.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[100px]">
                    {me?.firstName || me?.email?.split('@')[0]}
                  </span>
                  <span className="text-[9px] text-slate-400 capitalize mt-0.5">
                    {me?.roles?.[0] || 'Member'}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => void logout()}
                className="p-2 rounded-full border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap"
              >
                Sign In
              </Link>

              <Link
                to="/login?mode=register"
                className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] transition-all whitespace-nowrap"
              >
                <span>Get Started Free</span>
                <ArrowRight size={13} className="hidden sm:inline" />
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl px-4 py-5 space-y-4"
          >
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
                Role Solutions
              </div>
              <Link
                to={status === 'authenticated' ? '/educator/lesson-planner' : '/login?mode=register&role=teacher'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <GraduationCap size={16} className="text-blue-600" />
                <span>For Educators (Lesson Planning & Rubrics)</span>
              </Link>
              <Link
                to={status === 'authenticated' ? '/socratic-tutor' : '/login?mode=register&role=student'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Laptop size={16} className="text-emerald-600" />
                <span>For Students (Safe Socratic Sandbox)</span>
              </Link>
              <Link
                to={status === 'authenticated' ? (isSuperAdmin ? '/superadmin' : '/admin/dashboard') : '/login?mode=register&role=institute_management'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <School size={16} className="text-indigo-600" />
                <span>For School Districts & Administrators</span>
              </Link>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
                Platform Engines
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 px-1">
                {platformEngines.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.title}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon size={14} />
                      </div>
                      <span className="truncate">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
              <a
                href="/#interactive-demo"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Sparkles size={16} className="text-amber-500" />
                <span>Live Interactive Demo</span>
              </a>
              <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>ACARA V9 Australian Standards Mapped</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col gap-2">
              {status === 'authenticated' ? (
                <>
                  <Link
                    to="/dashboard"
                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs text-center shadow"
                  >
                    Go to Dashboard
                  </Link>
                  <Link
                    to="/profile"
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-slate-200 font-bold text-xs text-center"
                  >
                    View Account Profile
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-slate-200 font-bold text-xs text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login?mode=register"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs text-center shadow"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
export default Navbar
