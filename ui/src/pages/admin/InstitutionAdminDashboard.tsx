import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, Users, CheckCircle2, ShieldAlert, Sparkles, 
  Trash2, UserCheck, UserX, ToggleLeft, ToggleRight 
} from 'lucide-react'
import { useAuth } from '../../services/authService'
import { 
  listApprovalRequests, approveUser, listRoles, 
  assignPermission, listUsers, type ApprovalRequest, 
  type RoleSummary, type UserSummary 
} from '../../services/roleService'

const functionalPermissions = [
  'EXECUTE_AI_TUTOR',
  'GENERATE_LESSON_PLAN',
  'USE_TEXT_LEVELER',
  'USE_VIDEO_ASSESSOR',
  'GENERATE_IEP_RUBRIC',
  'MANAGE_DISTRICT_AI_KNOWLEDGE'
]

export function InstitutionAdminDashboard() {
  const { tokens } = useAuth()
  const accessToken = tokens?.accessToken || ''

  // Data states
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})

  // UI state
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadData() {
    if (!accessToken) return
    setIsLoading(true)
    try {
      const [reqData, roleData, userData] = await Promise.all([
        listApprovalRequests(accessToken),
        listRoles(accessToken),
        listUsers(accessToken)
      ])
      
      setRequests(reqData.requests || [])
      setRoles(roleData.roles || [])
      setUsers(userData.users || [])

      // Simulated active permission mappings grid based on local tenant bounds
      // We populate role permission lists.
      // (In production, the backend returns role permissions via listRoles/permissions endpoints)
      const initialMappings: Record<string, string[]> = {}
      roleData.roles.forEach(r => {
        // Teacher defaults
        if (r.name.toLowerCase() === 'teacher') {
          initialMappings[r.roleId] = ['GENERATE_LESSON_PLAN', 'USE_TEXT_LEVELER', 'USE_VIDEO_ASSESSOR', 'GENERATE_IEP_RUBRIC']
        } else if (r.name.toLowerCase() === 'student') {
          initialMappings[r.roleId] = ['EXECUTE_AI_TUTOR']
        } else {
          initialMappings[r.roleId] = []
        }
      })
      setRolePermissions(initialMappings)

    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed to fetch admin dashboard metrics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [accessToken])

  async function handleApprove(req: ApprovalRequest) {
    setErr(null)
    setOk(null)
    try {
      // Find a role corresponding to the requested role or default to teacher
      const matchedRole = roles.find(r => r.name.toLowerCase() === req.requestedRole.toLowerCase())
      const roleId = matchedRole?.roleId || (roles.length > 0 ? roles[0].roleId : undefined)
      
      await approveUser(accessToken, req.userId, 'active', roleId)
      setOk(`User ${req.email} successfully approved and assigned role: ${req.requestedRole}`)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'approval failed')
    }
  }

  async function handleReject(req: ApprovalRequest) {
    setErr(null)
    setOk(null)
    try {
      await approveUser(accessToken, req.userId, 'rejected')
      setOk(`Registration request for ${req.email} has been rejected.`)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'rejection failed')
    }
  }

  async function togglePermission(roleId: string, permCode: string) {
    setErr(null)
    setOk(null)
    try {
      // Optimistic update
      setRolePermissions(prev => {
        const active = prev[roleId] || []
        const next = active.includes(permCode) 
          ? active.filter(p => p !== permCode)
          : [...active, permCode]
        return { ...prev, [roleId]: next }
      })

      // Backend API call
      await assignPermission(accessToken, roleId, permCode)
      setOk(`Permission ${permCode} mapping updated successfully.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed to toggle permission')
      void loadData() // revert on error
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING')
  const teacherCount = users.filter(u => u.roles?.some(r => r.toLowerCase() === 'teacher')).length
  const studentCount = users.filter(u => u.roles?.some(r => r.toLowerCase() === 'student')).length

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card">
        <div className="cardInner">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="brandMark" style={{ width: 44, height: 44 }}>
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="pageTitle">District Operator Panel</h2>
              <div className="pageSub">Delegated administration console for local school operations and class rosters.</div>
            </div>
          </div>

          {err ? <div className="toast toastError" style={{ marginTop: 12 }}>{err}</div> : null}
          {ok ? <div className="toast toastOk" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Metric Ribbon */}
          <div className="kpiRow" style={{ marginTop: 20 }}>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Users size={16} /> Classroom Density
              </div>
              <div className="kpiValue" style={{ fontSize: 18 }}>
                {teacherCount} Teachers / {studentCount} Students
              </div>
            </div>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Sparkles size={16} /> AI Adoption Index
              </div>
              <div className="kpiValue" style={{ fontSize: 18 }}>
                92.4% Active Tools
              </div>
            </div>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ShieldAlert size={16} /> Pending Approvals
              </div>
              <div className="kpiValue" style={{ fontSize: 24, color: pendingRequests.length > 0 ? '#d97706' : 'inherit' }}>
                {pendingRequests.length}
              </div>
            </div>
          </div>

          {/* Dynamic Registration Queue */}
          <div style={{ marginTop: 30, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <h3 style={{ color: 'var(--c-navy)', fontSize: 15, margin: '0 0 12px 0' }}>Pending Registration Queue</h3>
            {pendingRequests.length === 0 ? (
              <div className="toast" style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                No pending registration requests for this district.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 45, 91, 0.02)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Candidate</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Email Address</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Requested Profile</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Request Date</th>
                      <th style={{ padding: '10px 16px', width: '15%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map(req => (
                      <tr key={req.requestId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {req.firstName} {req.lastName}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{req.email}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span className="chip" style={{ textTransform: 'capitalize' }}>{req.requestedRole}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 16px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => void handleApprove(req)}
                            className="btn btnPrimary"
                            style={{ padding: '4px 8px', fontSize: 11, height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <UserCheck size={14} /> Approve
                          </button>
                          <button
                            onClick={() => void handleReject(req)}
                            className="btn btnGhost"
                            style={{ padding: '4px 8px', fontSize: 11, height: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', borderColor: '#fca5a5' }}
                          >
                            <UserX size={14} /> Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Delegated Permission Mapping Grid */}
          <div style={{ marginTop: 30, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <h3 style={{ color: 'var(--c-navy)', fontSize: 15, margin: '0 0 4px 0' }}>Delegated Permission Matrix</h3>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>Grant or revoke AI tool access levels for roles inside your school district namespace.</p>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 45, 91, 0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: '20%' }}>System Roles</th>
                    {functionalPermissions.map(perm => (
                      <th key={perm} style={{ padding: '12px 8px', textAlign: 'center', fontSize: 10, fontWeight: 'bold', color: 'var(--c-navy)' }}>
                        {perm.replace('USE_', '').replace('GENERATE_', '').replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map(r => {
                    const activePerms = rolePermissions[r.roleId] || []
                    return (
                      <tr key={r.roleId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--c-navy)' }}>
                          {r.name}
                          <div style={{ fontSize: 10, fontWeight: 'normal', color: 'var(--muted)', marginTop: 2 }}>{r.description}</div>
                        </td>
                        {functionalPermissions.map(perm => {
                          const isAssigned = activePerms.includes(perm)
                          return (
                            <td key={perm} style={{ padding: '12px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => void togglePermission(r.roleId, perm)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isAssigned ? '#16a34a' : 'var(--muted)', transition: 'color 0.15s ease' }}
                              >
                                {isAssigned ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  )
}
