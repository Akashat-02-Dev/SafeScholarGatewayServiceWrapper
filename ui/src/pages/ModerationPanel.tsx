import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, apiFetch } from '../services/apiClient'
import { useAuth } from '../services/authService'

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
    <div style={{ padding: 16 }}>
      <h2>Moderation Panel</h2>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Sends moderation actions through the gateway proxy to the moderation service.
      </div>

      {err ? (
        <div style={{ marginTop: 12, color: 'crimson' }}>
          {err}
        </div>
      ) : null}
      {result ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Response</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{result}</pre>
        </div>
      ) : null}

      <div style={{ marginTop: 16, maxWidth: 520 }}>
        <form onSubmit={onSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label>
              Content ID (uuid)
              <input value={contentId} onChange={(e) => setContentId(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Action
              <select value={action} onChange={(e) => setAction(e.target.value as ModerationAction)} style={{ width: '100%' }}>
                <option value="approve">approve</option>
                <option value="reject">reject</option>
                <option value="flag">flag</option>
              </select>
            </label>
            <label>
              Reason (optional)
              <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%' }} />
            </label>
            <button type="submit" disabled={!hasPermission('MODERATE_CONTENT') || !accessToken || busy || !contentId.trim()}>
              Submit action
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
