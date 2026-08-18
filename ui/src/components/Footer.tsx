import { Heart, Github, Twitter, Linkedin } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto relative z-10 w-full">
      {/* Divider */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-300 dark:via-zinc-700 to-transparent opacity-50"></div>
      
      <div className="bg-white/40 dark:bg-zinc-950/40 backdrop-blur-3xl -webkit-backdrop-filter transform-gpu border-t border-white/40 dark:border-white/5 pb-8 pt-12 md:pb-12 md:pt-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8 mb-12">
            
            {/* Brand Column */}
            <div className="col-span-1 md:col-span-2">
              <Link to="/dashboard" className="flex items-center gap-3 font-serif font-bold text-xl text-blue-900 dark:text-blue-100 mb-4">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/75 dark:bg-zinc-800/75 shadow-sm border border-blue-900/10 dark:border-blue-100/10">
                  <img className="w-6 h-6 object-contain" src="/main-logo.png" alt="SafeScholar" />
                </span>
                SafeScholar
              </Link>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
                Empowering districts with secure, role-based AI workflows. Fostering a safe and intelligent learning environment for the next generation.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="w-9 h-9 rounded-full bg-white/60 dark:bg-zinc-800/60 flex items-center justify-center text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md transition-all border border-slate-200 dark:border-zinc-700">
                  <Twitter size={16} />
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/60 dark:bg-zinc-800/60 flex items-center justify-center text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md transition-all border border-slate-200 dark:border-zinc-700">
                  <Github size={16} />
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/60 dark:bg-zinc-800/60 flex items-center justify-center text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md transition-all border border-slate-200 dark:border-zinc-700">
                  <Linkedin size={16} />
                </a>
              </div>
            </div>

            {/* Links Column 1 */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">Platform</h4>
              <ul className="flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400">
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">District Pricing</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Integrations</a></li>
              </ul>
            </div>

            {/* Links Column 2 */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">Resources</h4>
              <ul className="flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400">
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">API Documentation</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Community Forum</a></li>
                <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Status</a></li>
              </ul>
            </div>

          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200/50 dark:border-zinc-800/50 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>&copy; {currentYear} SafeScholar. All rights reserved.</span>
            </div>
            
            <div className="flex items-center gap-1.5 font-medium">
              <span>Crafted with</span>
              <Heart size={14} className="text-red-500 fill-red-500 animate-pulse" />
              <span>for safe learning</span>
            </div>
            
            <div className="flex items-center gap-6 font-medium">
              <a href="#" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Privacy</a>
              <a href="#" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Terms</a>
              <a href="#" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
