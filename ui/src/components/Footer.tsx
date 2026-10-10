import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Heart, Github, Twitter, Linkedin, Shield, 
  CheckCircle2, ArrowRight
} from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [emailInput, setEmailInput] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailInput.trim()) return
    setSubscribed(true)
    setEmailInput('')
  }

  return (
    <footer className="mt-auto relative z-10 w-full border-t border-slate-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-zinc-950/80 backdrop-blur-2xl -webkit-backdrop-filter text-slate-700 dark:text-slate-300">
      {/* Top Institutional Trust Strip */}
      <div className="border-b border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-900/40 py-4">
        <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Institutional Grade AI Mesh: Cryptographically Isolated School Namespaces</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} />
                <span>Zero Model Retraining</span>
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <CheckCircle2 size={13} />
                <span>ACARA V9 Syllabus Mapped</span>
              </span>
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <CheckCircle2 size={13} />
                <span>COPPA & FERPA Guardrails</span>
              </span>
              <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                <CheckCircle2 size={13} />
                <span>Real-Time PII Sanitization</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Navigation Columns */}
      <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 mb-14">
          
          {/* Brand & Mission Statement Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <Link to="/" className="flex items-center gap-3 font-serif font-black text-xl text-slate-900 dark:text-white group">
              <img className="w-10 h-10 object-contain shrink-0 group-hover:scale-105 transition-transform duration-200" src="/main-logo.png" alt="SafeScholar Logo" />
              <div className="flex flex-col leading-none">
                <span className="text-xl font-bold tracking-tight">SafeScholar</span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">Enterprise Education AI</span>
              </div>
            </Link>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              SafeScholar is the secure, curriculum-aligned artificial intelligence platform engineered specifically for Australian and international school districts. Reclaim teacher preparation hours while safeguarding student inquiry.
            </p>

            {/* Live Infrastructure Status */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Normal • 99.99% Uptime</span>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-2 pt-1">
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noreferrer" 
                aria-label="Twitter"
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-center transition-colors shadow-xs"
              >
                <Twitter size={15} />
              </a>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noreferrer" 
                aria-label="GitHub"
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-zinc-800 flex items-center justify-center transition-colors shadow-xs"
              >
                <Github size={15} />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noreferrer" 
                aria-label="LinkedIn"
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-center transition-colors shadow-xs"
              >
                <Linkedin size={15} />
              </a>
            </div>
          </div>

          {/* Educator Suite Column (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Educator Suite</span>
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  ACARA Lesson Planner
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Standards Rubric Matrix
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Tiered Worksheet Studio
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Assessment & Quiz Studio
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Lexile Reading Leveler
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Report Card Comments
                </Link>
              </li>
            </ul>
          </div>

          {/* Student Sandbox Column (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Student Safe AI</span>
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <li>
                <Link to="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Socratic Inquiry Sandbox
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Writing Studio & Coach
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Classroom PIN Rooms
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Anti-Cheating Guardrails
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Student Text Simplifier
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Secure Test Environment
                </Link>
              </li>
            </ul>
          </div>

          {/* Governance & IT Column (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              <span>District Governance</span>
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <li>
                <Link to="/login?mode=register&role=institute_management" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Multi-Tenant Architecture
                </Link>
              </li>
              <li>
                <Link to="/login?mode=register&role=institute_management" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Approval Queue Gatekeeper
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Real-Time AI Moderation
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Curriculum RAG Ingestion
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Role Permission Matrix
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Tamper-Evident Auditing
                </Link>
              </li>
            </ul>
          </div>

          {/* Advisory Briefing / Newsletter Column (2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>District Briefing</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mb-3">
              Receive quarterly pedagogical frameworks and AI safety research for educational leaders.
            </p>

            {subscribed ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>Thank you! Subscribed to District Briefing.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="leader@district.edu"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Subscribe</span>
                  <ArrowRight size={12} />
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Bottom Metadata & Legal Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-medium">
            <span>&copy; {currentYear} SafeScholar Pty Ltd.</span>
            <span>•</span>
            <span>Enterprise Multi-Tenant Mesh</span>
          </div>

          <div className="flex items-center gap-1 font-medium">
            <span>Engineered with care for</span>
            <Heart size={13} className="text-rose-500 fill-rose-500" />
            <span>Australian & Global Classrooms</span>
          </div>

          <div className="flex items-center gap-5 font-semibold text-[11px]">
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Security Architecture
            </a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Trust Center
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
export default Footer
