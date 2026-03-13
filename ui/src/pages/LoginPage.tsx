import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { motion } from 'framer-motion'
import { Apple, ArrowRight, Chrome, KeyRound, LayoutGrid, LockKeyhole, Mail, Shield } from 'lucide-react'

export function LoginPage() {
  const { status, login, oauthLogin } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = useMemo(() => (loc.state as { from?: string } | null)?.from || '/dashboard', [loc.state])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
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
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'login failed')
    } finally {
      setBusy(false)
    }
  }

  async function startOAuth(provider: 'google' | 'microsoft' | 'apple') {
    if (busy || oauthBusy) return
    setErr(null)
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
                <h2 className="pageTitle" style={{ margin: 0 }}>Sign in</h2>
                <div className="pageSub">Use your SafeScholar account to continue.</div>
              </div>
            </div>

            <div className="divider" />

            <form onSubmit={onSubmit}>
              <div className="stack12">
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
                  {busy ? 'Signing in…' : 'Sign in'}
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>

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
          </div>
        </div>
      </motion.div>
    </div>
  )
}
