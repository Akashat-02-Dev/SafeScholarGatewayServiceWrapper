import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../services/apiClient'
import { useAuth } from '../services/authService'
import { assignRoleToUser, listRoles, type RoleSummary } from '../services/roleService'
import { motion } from 'framer-motion'
import { CheckCircle2, RefreshCw, UserPlus, Users } from 'lucide-react'

export function UserManagement() {
  const { tokens, hasPermission } = useAuth()
  const accessToken = tokens?.accessToken || null

  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [userId, setUserId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const selectedRole = useMemo(() => roles.find((r) => r.roleId === roleId) || null, [roles, roleId])

  useEffect(() => {
    if (!accessToken) return
    void (async () => {
      try {
        const data = await listRoles(accessToken)
        setRoles(data.roles || [])
      } catch {
        setRoles([])
      }
    })()
  }, [accessToken])

  async function refreshRoles() {
    if (!accessToken) return
    const data = await listRoles(accessToken)
    setRoles(data.roles || [])
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || busy) return
    setBusy(true)
    setErr(null)
    setOk(null)
    try {
      await assignRoleToUser(accessToken, userId, roleId)
      setOk(`Assigned role ${selectedRole?.name || roleId} to user ${userId}`)
      setUserId('')
      setRoleId('')
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
              <Users size={20} />
            </div>
            <div>
              <h2 className="pageTitle">User Management</h2>
              <div className="pageSub">Assign roles by user id. Listing users is not exposed by the gateway API.</div>
            </div>
            <div className="grow" />
            <button className="btn btnGhost" disabled={!accessToken || busy} onClick={() => void refreshRoles()}>
              <RefreshCw size={18} />
              Refresh roles
            </button>
          </div>

          {err ? (
            <div className="toast toastError" style={{ marginTop: 12 }}>
              {err}
            </div>
          ) : null}
          {ok ? (
            <div className="toast toastOk" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} />
              {ok}
            </div>
          ) : null}

          <div className="divider" />

          <div style={{ maxWidth: 560 }}>
            <form onSubmit={onAssign}>
              <div className="stack12">
                <div className="field">
                  <div className="label">User ID (uuid)</div>
                  <input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">Role</div>
                  <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                    <option value="" />
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>
                        {r.name}
                        {r.isSystem ? ' (system)' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedRole ? <div className="pageSub">Selected: {selectedRole.name}</div> : null}
                </div>
                <button type="submit" className="btn btnPrimary" disabled={!hasPermission('MANAGE_USERS') || !accessToken || busy || !userId.trim() || !roleId}>
                  <UserPlus size={18} />
                  Assign role
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
