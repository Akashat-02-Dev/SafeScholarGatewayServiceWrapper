import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, apiFetch } from '../services/apiClient'
import { useAuth } from '../services/authService'
import { motion } from 'framer-motion'
import { Flag, Megaphone, SendHorizonal, ShieldCheck } from 'lucide-react'

type ModerationAction = 'approve' | 'reject' | 'flag'

export function ModerationPanel() {
  const { tokens, hasPermission } = useAuth()
  const accessToken = tokens?.accessToken || null

  const [contentId, setContentId] = useState('')
  const [action, setAction] = useState<ModerationAction>('flag')
  const [reason, setReason] = useState('')

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || busy) return
    setBusy(true)
    setErr(null)
    setResult(null)
    try {
      const res = await apiFetch<string>('/api/moderation/moderation/actions', {
        method: 'POST',
        accessToken,
        body: { contentId, action, reason: reason || undefined },
        timeoutMs: 20_000,
      })
      setResult(typeof res === 'string' ? res : JSON.stringify(res))
      setContentId('')
      setReason('')
    } catch (e2) {
      if (e2 instanceof ApiError) {
        const rid = e2.requestId ? ` (requestId: ${e2.requestId})` : ''
        setErr(`${e2.message}${rid}`)
      } else {
        setErr(e2 instanceof Error ? e2.message : 'request failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="page">
      <div className="card">
        <div className="cardInner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="pageTitle">Moderation Panel</h2>
              <div className="pageSub">Send moderation actions via the gateway proxy.</div>
            </div>
          </div>

          {err ? (
            <div className="toast toastError" style={{ marginTop: 12 }}>
              {err}
            </div>
          ) : null}

          {result ? (
            <div className="toast" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Megaphone size={18} />
                <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Response</div>
              </div>
              <div className="divider" />
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{result}</pre>
            </div>
          ) : null}

          <div className="divider" />

          <div style={{ maxWidth: 640 }}>
            <form onSubmit={onSubmit}>
              <div className="stack12">
                <div className="field">
                  <div className="label">Content ID (uuid)</div>
                  <input className="input" value={contentId} onChange={(e) => setContentId(e.target.value)} />
                </div>
                <div className="grid2">
                  <div className="field">
                    <div className="label">Action</div>
                    <select className="select" value={action} onChange={(e) => setAction(e.target.value as ModerationAction)}>
                      <option value="approve">approve</option>
                      <option value="reject">reject</option>
                      <option value="flag">flag</option>
                    </select>
                  </div>
                  <div className="field">
                    <div className="label">Reason (optional)</div>
                    <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btnPrimary" disabled={!hasPermission('MODERATE_CONTENT') || !accessToken || busy || !contentId.trim()}>
                  {action === 'flag' ? <Flag size={18} /> : <SendHorizonal size={18} />}
                  Submit action
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
