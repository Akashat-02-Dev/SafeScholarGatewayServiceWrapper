import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../services/apiClient'
import { useAuth } from '../services/authService'
import { 
  assignPermission, unassignPermission, createRole, deleteRole, listRoles, listAllPermissions,
  type RoleSummary, type PermissionItem 
} from '../services/roleService'
import { motion } from 'framer-motion'
import { CheckCircle2, KeyRound, Plus, RefreshCw, Shield, Wand2, Trash2, X } from 'lucide-react'

const fallbackPermissions = [
  'SUPER_ADMIN',
  'MANAGE_USERS',
  'CREATE_USER',
  'DELETE_USER',
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
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const [assignRoleId, setAssignRoleId] = useState('')
  const [assignPerm, setAssignPerm] = useState('')

  const selectedRole = useMemo(() => roles.find((r) => r.roleId === assignRoleId) || null, [roles, assignRoleId])

  async function refresh() {
    if (!accessToken) return
    try {
      setErr(null)
      setOk(null)
      const [roleData, permData] = await Promise.allSettled([
        listRoles(accessToken),
        listAllPermissions(accessToken)
      ])
      if (roleData.status === 'fulfilled') {
        setRoles(roleData.value.roles || [])
      }
      if (permData.status === 'fulfilled') {
        setPermissions(permData.value.permissions || [])
      }
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

  useEffect(() => {
    void refresh()
  }, [accessToken])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || busy) return
    setBusy(true)
    setErr(null)
    try {
      await createRole(accessToken, name, description)
      setName('')
      setDescription('')
      setOk('Role created successfully.')
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

  async function onDeleteRole(roleId: string, roleName: string) {
    if (!confirm(`Are you sure you want to delete role "${roleName}"?`)) return
    if (!accessToken || busy) return
    setBusy(true)
    setErr(null)
    try {
      await deleteRole(accessToken, roleId)
      setOk(`Role "${roleName}" deleted successfully.`)
      await refresh()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to delete role')
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

  async function onUnassignPermission(roleId: string, permCode: string) {
    if (!accessToken || busy) return
    setBusy(true)
    setErr(null)
    try {
      await unassignPermission(accessToken, roleId, permCode)
      setOk(`Permission "${permCode}" removed from role.`)
      await refresh()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to unassign permission')
    } finally {
      setBusy(false)
    }
  }

  const availablePermCodes = useMemo(() => {
    if (permissions.length > 0) {
      return permissions.map(p => p.name)
    }
    return Array.from(fallbackPermissions)
  }, [permissions])

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="page">
      <div className="card">
        <div className="cardInner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 className="pageTitle">Role &amp; Permission Governance</h2>
              <div className="pageSub">Fine-grained RBAC configuration and capability matrix.</div>
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
                <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Existing Roles ({roles.length})</div>
              </div>
              <div className="divider" />
              <div className="stack12">
                {roles.map((r) => (
                  <div key={r.roleId} className="toast" style={{ background: 'rgba(255,255,255,0.75)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="chip" style={{ fontWeight: 650 }}>{r.name}</span>
                      {r.isSystem ? <span className="chip">System</span> : <span className="chip" style={{ background: '#f3e8ff', color: '#7e22ce' }}>Custom</span>}
                      {r.userCount !== undefined && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          ({r.userCount} {r.userCount === 1 ? 'user' : 'users'})
                        </span>
                      )}
                      <div className="grow" />
                      {!r.isSystem && (
                        <button
                          onClick={() => void onDeleteRole(r.roleId, r.name)}
                          title="Delete Custom Role"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    {r.description ? <div className="pageSub" style={{ marginTop: 6 }}>{r.description}</div> : null}
                    
                    {/* Role Permissions Badges */}
                    <div style={{ marginTop: 10 }}>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Assigned Permissions ({r.permissions?.length || 0})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {r.permissions && r.permissions.length > 0 ? (
                          r.permissions.map(p => (
                            <span 
                              key={p} 
                              className="chip" 
                              style={{ 
                                fontSize: '10px', 
                                padding: '2px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#eef2ff',
                                color: '#4338ca'
                              }}
                            >
                              <span>{p}</span>
                              {!r.isSystem && (
                                <button
                                  onClick={() => void onUnassignPermission(r.roleId, p)}
                                  style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 0, display: 'flex' }}
                                  title="Unassign permission"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No permissions assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {roles.length === 0 ? <div className="pageSub">No roles found.</div> : null}
              </div>
            </div>

            <div className="stack12">
              <div className="toast">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Plus size={18} />
                  <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Create Role</div>
                </div>
                <div className="divider" />
                <form onSubmit={onCreate}>
                  <div className="stack12">
                    <div className="field">
                      <div className="label">Name</div>
                      <input 
                        className="input font-mono" 
                        placeholder="e.g. lead_educator or curriculum_specialist"
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required
                      />
                    </div>
                    <div className="field">
                      <div className="label">Description</div>
                      <input 
                        className="input" 
                        placeholder="Brief summary of duties and responsibilities"
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                      />
                    </div>
                    <button type="submit" className="btn btnPrimary" disabled={!accessToken || busy}>
                      <Plus size={18} />
                      Create Role
                    </button>
                  </div>
                </form>
              </div>

              <div className="toast">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <KeyRound size={18} />
                  <div style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Assign Permission</div>
                </div>
                <div className="divider" />
                <form onSubmit={onAssignPermission}>
                  <div className="stack12">
                    <div className="field">
                      <div className="label">Role</div>
                      <select className="select" value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)} required>
                        <option value="">Select target role...</option>
                        {roles.map((r) => (
                          <option key={r.roleId} value={r.roleId}>
                            {r.name} {r.isSystem ? '(System)' : '(Custom)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <div className="label">Permission code</div>
                      <select className="select font-mono" value={assignPerm} onChange={(e) => setAssignPerm(e.target.value)} required>
                        <option value="">Select permission capability...</option>
                        {availablePermCodes.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button 
                      type="submit" 
                      className="btn btnGold" 
                      disabled={!hasPermission('MANAGE_PERMISSIONS') && !hasPermission('SUPER_ADMIN') || !accessToken || busy || !assignRoleId || !assignPerm}
                    >
                      Assign to {selectedRole ? selectedRole.name : 'role'}
                    </button>
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
