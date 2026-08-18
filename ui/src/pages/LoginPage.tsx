import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { apiFetch } from '../services/apiClient'
import { motion, AnimatePresence } from 'framer-motion'
import { Apple, ArrowRight, Chrome, KeyRound, LayoutGrid, LockKeyhole, Mail, Shield, User, CheckCircle2, AlertTriangle } from 'lucide-react'

export function LoginPage() {
  const { status, login, oauthLogin } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = useMemo(() => (loc.state as { from?: string } | null)?.from || '/dashboard', [loc.state])

  const [isRegister, setIsRegister] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [requestedRole, setRequestedRole] = useState('teacher')

  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [oauthBusy, setOauthBusy] = useState<'google' | 'microsoft' | 'apple' | null>(null)

  if (status === 'authenticated') {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErr(null)
    setOk(null)

    try {
      if (isForgotPassword) {
        const res = await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: { email }
        }) as { message?: string }
        setOk(res.message || 'If an account exists, a reset link has been generated.')
        setIsForgotPassword(false)
      } else if (isRegister) {
        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: { email, password, firstName, lastName, requestedRole }
        })
        setOk('Access request submitted successfully! An administrator must approve your account before you can sign in.')
        setIsRegister(false)
        setPassword('')
      } else {
        await login(email, password)
        navigate(from, { replace: true })
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function startOAuth(provider: 'google' | 'microsoft' | 'apple') {
    if (busy || oauthBusy) return
    setErr(null)
    setOk(null)
    setOauthBusy(provider)
    try {
      await oauthLogin(provider)
      navigate(from, { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'OAuth failed')
    } finally {
      setOauthBusy(null)
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
                {isForgotPassword ? 'Reset Password' : isRegister ? 'Request Access' : 'Sign in'}
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 m-0">
                {isForgotPassword
                  ? 'Enter your email to receive a password reset link.'
                  : isRegister
                  ? 'Submit a registration request for admin approval.'
                  : 'Use your SafeScholar account to continue.'}
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

            {!isForgotPassword && isRegister && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">First Name</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-2 border-transparent focus:border-blue-500 transition-colors outline-none rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Last Name</label>
                  <input
                    className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-2 border-transparent focus:border-blue-500 transition-colors outline-none rounded-2xl px-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Requested Role / Profile</label>
                  <select
                    className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-2 border-transparent focus:border-blue-500 transition-colors outline-none rounded-2xl px-4 py-3.5 text-slate-800 dark:text-slate-100 shadow-sm appearance-none"
                    value={requestedRole}
                    onChange={(e) => setRequestedRole(e.target.value)}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-2 border-transparent focus:border-blue-500 transition-colors outline-none rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  required
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setErr(null)
                        setOk(null)
                      }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full bg-white/80 dark:bg-zinc-900/60 dark:border-zinc-800 border-2 border-transparent focus:border-blue-500 transition-colors outline-none rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    required={!isForgotPassword}
                  />
                </div>
              </div>
            )}

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
              disabled={busy}
              className="mt-2 flex items-center justify-center gap-2 w-full py-4 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600 text-white font-bold shadow-md hover:shadow-lg disabled:opacity-70 transition-shadow"
            >
              <KeyRound size={18} />
              {isForgotPassword 
                ? (busy ? 'Sending...' : 'Send Reset Link') 
                : isRegister 
                  ? (busy ? 'Submitting request…' : 'Register') 
                  : (busy ? 'Signing in…' : 'Sign in')}
              <ArrowRight size={18} />
            </motion.button>
          </form>

          <div className="text-center mt-6">
            {isForgotPassword ? (
              <button
                type="button"
                className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                onClick={() => {
                  setIsForgotPassword(false)
                  setErr(null)
                  setOk(null)
                }}
              >
                Back to Sign in
              </button>
            ) : (
              <button
                type="button"
                className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                onClick={() => {
                  setIsRegister(!isRegister)
                  setErr(null)
                  setOk(null)
                }}
              >
                {isRegister ? 'Already have an account? Sign in' : 'Don\'t have an account? Request Access'}
              </button>
            )}
          </div>

          {!isRegister && !isForgotPassword && (
            <>
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700/50" />
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Or continue with</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700/50" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.button
                  type="button"
                  disabled={busy || !!oauthBusy}
                  onClick={() => void startOAuth('google')}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/80 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <Chrome size={20} className="text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {oauthBusy === 'google' ? 'Wait…' : 'Google'}
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  disabled={busy || !!oauthBusy}
                  onClick={() => void startOAuth('microsoft')}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/80 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <LayoutGrid size={20} className="text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {oauthBusy === 'microsoft' ? 'Wait…' : 'Microsoft'}
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  disabled={busy || !!oauthBusy}
                  onClick={() => void startOAuth('apple')}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/80 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <Apple size={20} className="text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {oauthBusy === 'apple' ? 'Wait…' : 'Apple'}
                  </span>
                </motion.button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
