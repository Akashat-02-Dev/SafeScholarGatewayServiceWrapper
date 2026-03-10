import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../services/apiClient'
import { useAuth } from '../services/authService'
import { assignRoleToUser, listRoles, type RoleSummary } from '../services/roleService'

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
    <div style={{ padding: 16 }}>
      <h2>User Management</h2>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Assign roles by user id. Listing users is not exposed by the gateway API.
      </div>

      <div style={{ marginTop: 12 }}>
        <button disabled={!accessToken || busy} onClick={() => void refreshRoles()}>
          Refresh roles
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, color: 'crimson' }}>
          {err}
        </div>
      ) : null}
      {ok ? (
        <div style={{ marginTop: 12, color: 'green' }}>
          {ok}
        </div>
      ) : null}

      <div style={{ marginTop: 16, maxWidth: 520 }}>
        <form onSubmit={onAssign}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label>
              User ID (uuid)
              <input value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label>
              Role
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ width: '100%' }}>
                <option value="" />
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    {r.name}
                    {r.isSystem ? ' (system)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!hasPermission('MANAGE_USERS') || !accessToken || busy || !userId.trim() || !roleId}>
              Assign role
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
