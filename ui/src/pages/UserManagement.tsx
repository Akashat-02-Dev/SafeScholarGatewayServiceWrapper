import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../services/apiClient'
import { useAuth } from '../services/authService'
import { 
  assignRoleToUser, 
  listRoles, 
  listUsers, 
  approveUser, 
  deleteUser,
  type RoleSummary, 
  type UserSummary 
} from '../services/roleService'
import { IsolateUserModal } from '../components/modals/IsolateUserModal'
import { motion } from 'framer-motion'
import { CheckCircle2, RefreshCw, UserPlus, Users, Check, X, ShieldAlert, Lock, Unlock, Trash2 } from 'lucide-react'

export function UserManagement() {
  const { tokens, hasPermission } = useAuth()
  const accessToken = tokens?.accessToken || null

  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null)
  
  const [roleId, setRoleId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'status' | 'delete', targetStatus?: 'active' | 'isolated' } | null>(null)
  const [isIsolateModalOpen, setIsIsolateModalOpen] = useState(false)

  const selectedRole = useMemo(() => roles.find((r) => r.roleId === roleId) || null, [roles, roleId])

  async function loadData() {
    if (!accessToken) return
    setBusy(true)
    try {
      const rolesRes = await listRoles(accessToken)
      setRoles(rolesRes.roles || [])
      
      const usersRes = await listUsers(accessToken)
      setUsers(usersRes.users || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed to load users data')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [accessToken])

  async function onAssign(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || busy || !selectedUser || !roleId) return
    setBusy(true)
    setErr(null)
    setOk(null)
    try {
      await assignRoleToUser(accessToken, selectedUser.userId, roleId)
      setOk(`Assigned role "${selectedRole?.name}" to user ${selectedUser.email}`)
      setRoleId('')
      // Reload users list to see updated roles
      const usersRes = await listUsers(accessToken)
      setUsers(usersRes.users || [])
      // Update selected user cache
      const updated = usersRes.users?.find(u => u.userId === selectedUser.userId) || null
      setSelectedUser(updated)
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'request failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleApproval(status: 'active' | 'rejected') {
    if (!accessToken || busy || !selectedUser) return
    setBusy(true)
    setErr(null)
    setOk(null)
    try {
      // Pass the selected roleId if approving
      const activeRole = status === 'active' ? roleId : undefined
      await approveUser(accessToken, selectedUser.userId, status, activeRole)
      setOk(`User ${selectedUser.email} has been successfully ${status === 'active' ? 'approved' : 'rejected'}.`)
      
      // Reload data
      const usersRes = await listUsers(accessToken)
      setUsers(usersRes.users || [])
      setSelectedUser(null)
      setRoleId('')
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'approval request failed')
    } finally {
      setBusy(false)
    }
  }

  function handleConfirmStatusChange(targetStatus: 'active' | 'isolated') {
    setConfirmAction({ type: 'status', targetStatus })
  }

  function handleConfirmDelete() {
    setConfirmAction({ type: 'delete' })
  }

  async function executeStatusChange(targetStatus: 'active' | 'isolated') {
    if (!accessToken || busy || !selectedUser) return
    setBusy(true)
    setErr(null)
    setOk(null)
    setConfirmAction(null)
    try {
      await approveUser(accessToken, selectedUser.userId, targetStatus)
      setOk(`User ${selectedUser.email} status has been updated to ${targetStatus}.`)
      
      const usersRes = await listUsers(accessToken)
      setUsers(usersRes.users || [])
      setSelectedUser(null)
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'status update failed')
    } finally {
      setBusy(false)
    }
  }

  async function executeDelete() {
    if (!accessToken || busy || !selectedUser) return
    setBusy(true)
    setErr(null)
    setOk(null)
    setConfirmAction(null)
    try {
      await deleteUser(accessToken, selectedUser.userId)
      setOk(`User account ${selectedUser.email} has been permanently deleted.`)
      
      const usersRes = await listUsers(accessToken)
      setUsers(usersRes.users || [])
      setSelectedUser(null)
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="page">
      <div className="card">
        <div className="cardInner">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <Users size={20} />
            </div>
            <div>
              <h2 className="pageTitle">User Management</h2>
              <div className="pageSub">Manage user registrations, assign RBAC roles, and approve new user sign ups.</div>
            </div>
            <div className="grow" />
            <button className="btn btnGhost" disabled={!accessToken || busy} onClick={() => void loadData()}>
              <RefreshCw size={14} />
              Refresh list
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

          {/* Grid splits user listing and selection details */}
          <div className="grid2" style={{ marginTop: 20, alignItems: 'stretch' }}>
            
            {/* Left Column: Users List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: '700', color: 'var(--c-navy)', marginBottom: 4 }}>
                Registered Users ({users.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                {users.map((user) => {
                  const isSelected = selectedUser?.userId === user.userId
                  return (
                    <div
                      key={user.userId}
                      onClick={() => {
                        setSelectedUser(user)
                        setErr(null)
                        setOk(null)
                        setRoleId('')
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '1px solid var(--c-navy)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(0, 45, 91, 0.04)' : 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-navy)' }}>
                          {user.firstName} {user.lastName}
                        </span>
                        {/* Status Badge */}
                        <span
                          className="chip"
                          style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            textTransform: 'uppercase',
                            background: user.status === 'active' 
                              ? 'rgba(34, 197, 94, 0.1)' 
                              : user.status === 'pending' 
                              ? 'rgba(251, 191, 36, 0.1)' 
                              : user.status === 'isolated' 
                              ? 'rgba(107, 114, 128, 0.1)' 
                              : 'rgba(239, 68, 68, 0.1)',
                            color: user.status === 'active' 
                              ? '#16a34a' 
                              : user.status === 'pending' 
                              ? '#d97706' 
                              : user.status === 'isolated' 
                              ? '#4b5563' 
                              : '#dc2626',
                            border: 'none'
                          }}
                        >
                          {user.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {user.email}
                      </div>
                      {user.roles && user.roles.length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {user.roles.map(r => (
                            <span key={r} className="chip" style={{ fontSize: '9px', padding: '1px 6px', textTransform: 'lowercase' }}>
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '10px', color: 'var(--muted)', fontStyle: 'italic', marginTop: 4 }}>
                          No roles assigned
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Column: User Management / Approval Form */}
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
              {selectedUser ? (
                <div className="stack12">
                  <div style={{ fontSize: 13, fontWeight: '700', color: 'var(--c-navy)' }}>
                    Manage: {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', background: 'rgba(255, 255, 255, 0.4)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div><strong>User ID:</strong> {selectedUser.userId}</div>
                    <div style={{ marginTop: 4 }}><strong>Email:</strong> {selectedUser.email}</div>
                    <div style={{ marginTop: 4 }}><strong>Status:</strong> {selectedUser.status}</div>
                    <div style={{ marginTop: 4 }}><strong>Institution ID:</strong> {selectedUser.institutionId || 'None'}</div>
                  </div>

                  {confirmAction ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(220, 38, 38, 0.3)', padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(220, 38, 38, 0.03)' }}>
                      <div style={{ fontSize: 12, fontWeight: '700', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldAlert size={14} />
                        Confirm Security Action
                      </div>
                      <p style={{ fontSize: 11, margin: 0 }}>
                        {confirmAction.type === 'delete' 
                          ? `Are you sure you want to permanently delete the account for ${selectedUser.email}? This action is irreversible.`
                          : `Are you sure you want to change the status of ${selectedUser.email} to ${confirmAction.targetStatus}?`}
                      </p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btnPrimary"
                          disabled={busy}
                          onClick={() => {
                            if (confirmAction.type === 'delete') {
                              void executeDelete()
                            } else {
                              void executeStatusChange(confirmAction.targetStatus!)
                            }
                          }}
                          style={{ flex: 1, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, padding: '8px 12px' }}
                        >
                          Yes, Confirm
                        </button>
                        <button
                          type="button"
                          className="btn btnGhost"
                          disabled={busy}
                          onClick={() => setConfirmAction(null)}
                          style={{ fontSize: 12, padding: '8px 12px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {selectedUser.status === 'pending' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(251, 191, 36, 0.3)', padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(251, 191, 36, 0.03)' }}>
                          <div style={{ fontSize: 12, fontWeight: '700', color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ShieldAlert size={14} />
                            Pending Approval Action
                          </div>
                          
                          <div className="field">
                            <div className="label">Assign Initial Role on Approval</div>
                            <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                              <option value="">-- select starting role --</option>
                              {roles.map((r) => (
                                <option key={r.roleId} value={r.roleId}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                            <button
                              type="button"
                              className="btn btnPrimary"
                              disabled={busy || !roleId}
                              onClick={() => void handleApproval('active')}
                              style={{ flex: 1, gap: 6, fontSize: 12, padding: '8px 12px' }}
                            >
                              <Check size={14} />
                              Approve & Assign Role
                            </button>
                            <button
                              type="button"
                              className="btn btnGhost"
                              disabled={busy}
                              onClick={() => void handleApproval('rejected')}
                              style={{ color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.2)', fontSize: 12, padding: '8px 12px' }}
                            >
                              <X size={14} />
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={onAssign} className="stack12">
                          <div className="field">
                            <div className="label">Assign Additional Role</div>
                            <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                              <option value="">-- select role --</option>
                              {roles.map((r) => (
                                <option key={r.roleId} value={r.roleId}>
                                  {r.name} {r.isSystem ? ' (system)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <button
                            type="submit"
                            className="btn btnPrimary"
                            disabled={!hasPermission('MANAGE_USERS') || busy || !roleId}
                          >
                            <UserPlus size={16} />
                            Assign Role
                          </button>
                        </form>
                      )}

                      {/* Account Status / Security Operations */}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }} className="stack12">
                        <div style={{ fontSize: 12, fontWeight: '700', color: 'var(--c-navy)' }}>
                          Account Security Actions
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {selectedUser.status === 'active' && (
                            <button
                              type="button"
                              className="btn btnGhost"
                              disabled={busy}
                              onClick={() => setIsIsolateModalOpen(true)}
                              style={{ color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.2)', fontSize: 12, padding: '8px 12px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            >
                              <Lock size={14} />
                              Isolate Account
                            </button>
                          )}

                          {selectedUser.status === 'isolated' && (
                            <button
                              type="button"
                              className="btn btnPrimary"
                              disabled={busy}
                              onClick={() => handleConfirmStatusChange('active')}
                              style={{ fontSize: 12, padding: '8px 12px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            >
                              <Unlock size={14} />
                              Activate Account
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btnGhost"
                            disabled={busy}
                            onClick={() => setIsIsolateModalOpen(true)}
                            style={{ color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.2)', fontSize: 12, padding: '8px 12px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <Trash2 size={14} />
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', padding: '60px 0' }}>
                  <Users size={32} style={{ opacity: 0.65, marginBottom: 8 }} />
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>No User Selected</div>
                  <p style={{ fontSize: '11px', maxWidth: '240px', margin: '4px 0 0 0' }}>
                    Select a user from the active namespace on the left to approve registration requests or change user roles.
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      <IsolateUserModal
        isOpen={isIsolateModalOpen}
        user={selectedUser}
        accessToken={accessToken}
        onClose={() => setIsIsolateModalOpen(false)}
        onSuccess={(msg) => {
          setOk(msg)
          setSelectedUser(null)
          void loadData()
        }}
      />
    </motion.div>
  )
}
