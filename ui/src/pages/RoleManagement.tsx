import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../services/apiClient'
import { useAuth } from '../services/authService'
import { assignPermission, createRole, listRoles, type RoleSummary } from '../services/roleService'
import { motion } from 'framer-motion'
import { CheckCircle2, KeyRound, Plus, RefreshCw, Shield, Wand2 } from 'lucide-react'

const immutablePermissions = [
  'SUPER_ADMIN',
  'MANAGE_USERS',
  'MANAGE_ROLES',
  'CREATE_ROLE',
  'ASSIGN_ROLE',
  'ASSIGN_PERMISSION',
  'VIEW_WORKSHEET',
  'VIEW_ASSESSMENT',
  'MODERATE_CONTENT',
  'EXECUTE_AI_TUTOR',
  'GENERATE_LESSON_PLAN',
  'USE_TEXT_LEVELER',
  'USE_VIDEO_ASSESSOR',
  'GENERATE_IEP_RUBRIC',
  'MANAGE_DISTRICT_AI_KNOWLEDGE',
  'VIEW_AI_AUDIT_LOGS',
  'MANAGE_GLOBAL_TENANTS',
  'MANAGE_LOCAL_ROLES',
] as const

export function RoleManagement() {
  const { tokens, hasPermission } = useAuth()
  const accessToken = tokens?.accessToken || null

  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
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
        setOk(null)
        const data = await listRoles(accessToken)
        setRoles(data.roles || [])
      } catch (e) {
        if (e instanceof ApiError) {
          const rid = e.requestId ? ` (requestId: ${e.requestId})` : ''
          setErr(`${e.message}${rid}`)
        } else {
          setErr(e instanceof Error ? e.message : 'request failed')
        }
        setOk(null)
        setRoles([])
      }
    })()
  }, [accessToken])

  async function refresh() {
    if (!accessToken) return
    try {
      setErr(null)
      setOk(null)
      const data = await listRoles(accessToken)
      setRoles(data.roles || [])
    } catch (e) {
      if (e instanceof ApiError) {
        const rid = e.requestId ? ` (requestId: ${e.requestId})` : ''
        setErr(`${e.message}${rid}`)
      } else {
        setErr(e instanceof Error ? e.message : 'request failed')
      }
      setOk(null)
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
      setOk('Role created.')
      await refresh()
    } catch (e2) {
      if (e2 instanceof ApiError) {
        const rid = e2.requestId ? ` (requestId: ${e2.requestId})` : ''
        setErr(`${e2.message}${rid}`)
      } else {
        setErr(e2 instanceof Error ? e2.message : 'request failed')
      }
      setOk(null)
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
      setOk('Permission assigned.')
    } catch (e2) {
      if (e2 instanceof ApiError) {
        const rid = e2.requestId ? ` (requestId: ${e2.requestId})` : ''
        setErr(`${e2.message}${rid}`)
      } else {
        setErr(e2 instanceof Error ? e2.message : 'request failed')
      }
      setOk(null)
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
              <Shield size={20} />
            </div>
            <div>
              <h2 className="pageTitle">Role Management</h2>
              <div className="pageSub">Create roles and assign permission codes.</div>
            </div>
            <div className="grow" />
            <button onClick={() => void refresh()} disabled={!accessToken || busy} className="btn btnGhost">
              <RefreshCw size={18} />
              Refresh
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

          <div className="grid2">
            <div className="toast">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Wand2 size={18} />
                <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Existing roles</div>
                <div className="grow" />
                <div className="pageSub" style={{ marginTop: 0 }}>{roles.length} total</div>
              </div>
              <div className="divider" />
              <div className="stack12">
                {roles.map((r) => (
                  <div key={r.roleId} className="toast" style={{ background: 'rgba(255,255,255,0.64)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="chip" style={{ fontWeight: 650 }}>{r.name}</span>
                      {r.isSystem ? <span className="chip">system</span> : null}
                    </div>
                    <div className="pageSub mono" style={{ marginTop: 10 }}>{r.roleId}</div>
                    {r.description ? <div className="pageSub" style={{ marginTop: 8 }}>{r.description}</div> : null}
                  </div>
                ))}
                {roles.length === 0 ? <div className="pageSub">No roles found.</div> : null}
              </div>
            </div>

            <div className="stack12">
              <div className="toast">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Plus size={18} />
                  <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Create role</div>
                </div>
                <div className="divider" />
                <form onSubmit={onCreate}>
                  <div className="stack12">
                    <div className="field">
                      <div className="label">Name</div>
                      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="field">
                      <div className="label">Description</div>
                      <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btnPrimary" disabled={!accessToken || busy}>
                      <Plus size={18} />
                      Create role
                    </button>
                  </div>
                </form>
              </div>

              <div className="toast">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <KeyRound size={18} />
                  <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Assign permission</div>
                </div>
                <div className="divider" />
                <form onSubmit={onAssignPermission}>
                  <div className="stack12">
                    <div className="field">
                      <div className="label">Role</div>
                      <select className="select" value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}>
                        <option value="" />
                        {roles.map((r) => (
                          <option key={r.roleId} value={r.roleId} disabled={r.isSystem}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <div className="label">Permission code</div>
                      <select className="select" value={assignPerm} onChange={(e) => setAssignPerm(e.target.value)}>
                        <option value="" />
                        {immutablePermissions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="btn btnGold" disabled={!hasPermission('MANAGE_PERMISSIONS') || !accessToken || busy || !assignRoleId || !assignPerm}>
                      Assign to {selectedRole ? selectedRole.name : 'role'}
                    </button>
                    {!hasPermission('MANAGE_PERMISSIONS') ? (
                      <div className="pageSub">Missing permission: MANAGE_PERMISSIONS</div>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
