import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, LockKeyhole, AlertTriangle, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '../services/apiClient'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] w-full p-4 sm:p-6">
        <div className="bg-white/60 dark:bg-zinc-900/60 p-6 rounded-[2.5rem] text-center border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold mb-2">Invalid Request</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">No password reset token was provided.</p>
          <button 
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-colors"
          >
            Return to Sign in
          </button>
        </div>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (password !== confirmPassword) {
      setErr("Passwords do not match")
      return
    }

    setBusy(true)
    setErr(null)
    setOk(null)

    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword: password }
      }) as { message?: string }
      setOk(res.message || 'Password successfully reset.')
      // Redirect to login after a short delay
      setTimeout(() => navigate('/login'), 2500)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to reset password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] w-full p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-lg"
      >
        <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/40 dark:border-white/10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 sm:p-10">
          
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg border border-white/20">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-serif m-0">
                Set New Password
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 m-0">
                Please enter your new password below.
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200/50 dark:bg-zinc-700/50 my-6" />

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <AnimatePresence mode="wait">
              {ok && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-2xl text-sm font-semibold border border-emerald-200 dark:border-emerald-800/50"
                >
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{ok}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">New Password</label>
              <div className="relative">
                <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-2 border-transparent focus:border-blue-500 transition-colors outline-none rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Confirm New Password</label>
              <div className="relative">
                <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-2 border-transparent focus:border-blue-500 transition-colors outline-none rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {err && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-sm font-semibold border border-red-200 dark:border-red-800/50"
                  role="alert"
                >
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{err}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button 
              type="submit" 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={busy || !!ok}
              className="mt-2 flex items-center justify-center gap-2 w-full py-4 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600 text-white font-bold shadow-md hover:shadow-lg disabled:opacity-70 transition-shadow"
            >
              <KeyRound size={18} />
              {busy ? 'Updating...' : ok ? 'Redirecting...' : 'Reset Password'}
              <ArrowRight size={18} />
            </motion.button>
          </form>

          <div className="text-center mt-6">
            <button
              type="button"
              className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              onClick={() => navigate('/login')}
            >
              Cancel and return to Sign in
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  )
}
