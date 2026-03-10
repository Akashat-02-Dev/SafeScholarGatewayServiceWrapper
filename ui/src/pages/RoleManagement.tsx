import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../services/apiClient'
import { useAuth } from '../services/authService'
import { assignPermission, createRole, listRoles, type RoleSummary } from '../services/roleService'

const immutablePermissions = [
  'VIEW_DASHBOARD',
  'MANAGE_USERS',
  'MANAGE_ROLES',
  'MANAGE_PERMISSIONS',
  'VIEW_WORKSHEET',
  'VIEW_ASSESSMENT',
  'MODERATE_CONTENT',
] as const

export function RoleManagement() {
  const { tokens, hasPermission } = useAuth()
  const accessToken = tokens?.accessToken || null

  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const [assignRoleId, setAssignRoleId] = useState('')
  const [assignPerm, setAssignPerm] = useState('')

  const selectedRole = useMemo(() => roles.find((r) => r.roleId === assignRoleId) || null, [roles, assignRoleId])

  useEffect(() => {
    if (!accessToken) return
    void (async () => {
      try {
        setErr(null)
        const data = await listRoles(accessToken)
        setRoles(data.roles || [])
      } catch (e) {
        if (e instanceof ApiError) {
          const rid = e.requestId ? ` (requestId: ${e.requestId})` : ''
          setErr(`${e.message}${rid}`)
        } else {
          setErr(e instanceof Error ? e.message : 'request failed')
        }
        setRoles([])
      }
    })()
  }, [accessToken])

  async function refresh() {
    if (!accessToken) return
    try {
      setErr(null)
      const data = await listRoles(accessToken)
      setRoles(data.roles || [])
    } catch (e) {
      if (e instanceof ApiError) {
        const rid = e.requestId ? ` (requestId: ${e.requestId})` : ''
        setErr(`${e.message}${rid}`)
      } else {
        setErr(e instanceof Error ? e.message : 'request failed')
      }
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || busy) return
    setBusy(true)
    setErr(null)
    try {
      await createRole(accessToken, name, description)
      setName('')
      setDescription('')
      await refresh()
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

  async function onAssignPermission(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || busy) return
    setBusy(true)
    setErr(null)
    try {
      await assignPermission(accessToken, assignRoleId, assignPerm)
      setAssignPerm('')
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
      <h2>Role Management</h2>
      {err ? <div style={{ color: 'crimson', marginBottom: 12 }}>{err}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>Existing</h3>
          <button onClick={() => void refresh()} disabled={!accessToken || busy}>
            Refresh
          </button>
          <ul>
            {roles.map((r) => (
              <li key={r.roleId}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong>{r.name}</strong>
                  {r.isSystem ? <span>(system)</span> : null}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{r.roleId}</div>
                {r.description ? <div>{r.description}</div> : null}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h3>Create</h3>
            <form onSubmit={onCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label>
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
                </label>
                <label>
                  Description
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </label>
                <button type="submit" disabled={!accessToken || busy}>
                  Create role
                </button>
              </div>
            </form>
          </div>

          <div>
            <h3>Assign Permission</h3>
            <form onSubmit={onAssignPermission}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label>
                  Role
                  <select value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}>
                    <option value="" />
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId} disabled={r.isSystem}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Permission code
                  <select value={assignPerm} onChange={(e) => setAssignPerm(e.target.value)} style={{ width: '100%' }}>
                    <option value="" />
                    {immutablePermissions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={!hasPermission('MANAGE_PERMISSIONS') || !accessToken || busy || !assignRoleId || !assignPerm}>
                  Assign to {selectedRole ? selectedRole.name : 'role'}
                </button>
              </div>
            </form>
            {!hasPermission('MANAGE_PERMISSIONS') ? (
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>Missing permission: MANAGE_PERMISSIONS</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
