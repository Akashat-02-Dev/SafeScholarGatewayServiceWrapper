import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { apiFetch } from '../services/apiClient'
import { motion } from 'framer-motion'
import { Apple, ArrowRight, Chrome, KeyRound, LayoutGrid, LockKeyhole, Mail, Shield, User, CheckCircle2 } from 'lucide-react'

export function LoginPage() {
  const { status, login, oauthLogin } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = useMemo(() => (loc.state as { from?: string } | null)?.from || '/dashboard', [loc.state])

  const [isRegister, setIsRegister] = useState(false)
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
      if (isRegister) {
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
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ maxWidth: 520, margin: '34px auto' }}
      >
        <div className="card">
          <div className="cardInner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="brandMark" style={{ width: 44, height: 44 }}>
                <Shield size={22} />
              </div>
              <div>
                <h2 className="pageTitle" style={{ margin: 0 }}>
                  {isRegister ? 'Request Access' : 'Sign in'}
                </h2>
                <div className="pageSub">
                  {isRegister
                    ? 'Submit a registration request for admin approval.'
                    : 'Use your SafeScholar account to continue.'}
                </div>
              </div>
            </div>

            <div className="divider" />

            <form onSubmit={onSubmit}>
              <div className="stack12">
                {ok ? (
                  <div className="toast toastOk" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={18} />
                    <span>{ok}</span>
                  </div>
                ) : null}

                {isRegister ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field">
                      <div className="label">First Name</div>
                      <div style={{ position: 'relative' }}>
                        <User size={18} style={{ position: 'absolute', left: 12, top: 12, opacity: 0.65 }} />
                        <input
                          className="input"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          style={{ paddingLeft: 40 }}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <div className="label">Last Name</div>
                      <input
                        className="input"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field" style={{ gridColumn: 'span 2' }}>
                      <div className="label">Requested Role / Profile</div>
                      <select
                        className="select"
                        value={requestedRole}
                        onChange={(e) => setRequestedRole(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="teacher">Teacher</option>
                        <option value="student">Student</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                <div className="field">
                  <div className="label">Email</div>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: 12, top: 12, opacity: 0.65 }} />
                    <input
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      inputMode="email"
                      required
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                <div className="field">
                  <div className="label">Password</div>
                  <div style={{ position: 'relative' }}>
                    <LockKeyhole size={18} style={{ position: 'absolute', left: 12, top: 12, opacity: 0.65 }} />
                    <input
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      autoComplete="current-password"
                      required
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>

                {err ? (
                  <div className="toast toastError" role="alert">
                    {err}
                  </div>
                ) : null}

                <button type="submit" className="btn btnPrimary" disabled={busy}>
                  <KeyRound size={18} />
                  {isRegister ? (busy ? 'Submitting request…' : 'Register') : (busy ? 'Signing in…' : 'Sign in')}
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                className="btn btnGhost"
                style={{ fontSize: 13, padding: '6px 16px' }}
                onClick={() => {
                  setIsRegister(!isRegister)
                  setErr(null)
                  setOk(null)
                }}
              >
                {isRegister ? 'Already have an account? Sign in' : 'Don\'t have an account? Request Access'}
              </button>
            </div>

            {!isRegister ? (
              <>
                <div className="divider" />
                <div className="pageSub" style={{ marginTop: 0 }}>Or continue with</div>
                <div className="oauthGrid">
                  <motion.button
                    type="button"
                    className="btn btnGhost oauthBtn"
                    disabled={busy || !!oauthBusy}
                    onClick={() => void startOAuth('google')}
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                  >
                    <span className="oauthIcon">
                      <Chrome size={18} />
                    </span>
                    <span className="oauthText">
                      <span className="oauthTitle">Google</span>
                      <span className="oauthSub">{oauthBusy === 'google' ? 'Connecting…' : 'Continue'}</span>
                    </span>
                  </motion.button>

                  <motion.button
                    type="button"
                    className="btn btnGhost oauthBtn"
                    disabled={busy || !!oauthBusy}
                    onClick={() => void startOAuth('microsoft')}
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                  >
                    <span className="oauthIcon">
                      <LayoutGrid size={18} />
                    </span>
                    <span className="oauthText">
                      <span className="oauthTitle">Microsoft</span>
                      <span className="oauthSub">{oauthBusy === 'microsoft' ? 'Connecting…' : 'Continue'}</span>
                    </span>
                  </motion.button>

                  <motion.button
                    type="button"
                    className="btn btnGhost oauthBtn"
                    disabled={busy || !!oauthBusy}
                    onClick={() => void startOAuth('apple')}
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                  >
                    <span className="oauthIcon">
                      <Apple size={18} />
                    </span>
                    <span className="oauthText">
                      <span className="oauthTitle">Apple</span>
                      <span className="oauthSub">{oauthBusy === 'apple' ? 'Connecting…' : 'Continue'}</span>
                    </span>
                  </motion.button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
