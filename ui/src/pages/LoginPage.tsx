import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/authService'

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
    <div style={{ maxWidth: 420, margin: '48px auto', padding: 16 }}>
      <h2>Sign in</h2>
      <form onSubmit={onSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              style={{ width: '100%' }}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}
        </div>
      </form>
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || !!oauthBusy} onClick={() => void startOAuth('google')}>
          {oauthBusy === 'google' ? 'Connecting…' : 'Continue with Google'}
        </button>
        <button type="button" disabled={busy || !!oauthBusy} onClick={() => void startOAuth('microsoft')}>
          {oauthBusy === 'microsoft' ? 'Connecting…' : 'Continue with Microsoft'}
        </button>
        <button type="button" disabled={busy || !!oauthBusy} onClick={() => void startOAuth('apple')}>
          {oauthBusy === 'apple' ? 'Connecting…' : 'Continue with Apple'}
        </button>
      </div>
    </div>
  )
}
