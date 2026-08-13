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
      <div className="card shadow-lg border border-slate-200/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden">
        <div className="cardInner p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg">
                <Building2 size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">District Operator Panel</h2>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Delegated administration console for local school operations and class rosters.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                Institute Tier
              </span>
            </div>
          </div>

          {err ? <div className="toast toastError mb-4">{err}</div> : null}
          {ok ? <div className="toast toastOk mb-4 flex items-center gap-2"><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Metric Ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-2xl opacity-60"></div>
              <div className="flex items-center gap-3 mb-2 text-slate-600 dark:text-slate-300 font-semibold text-sm">
                <Users size={18} className="text-blue-600 dark:text-blue-400" /> Classroom Density
              </div>
              <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                {teacherCount} <span className="text-lg font-medium text-slate-500 dark:text-slate-400">Teachers</span>
              </div>
              <div className="text-lg font-medium text-slate-600 dark:text-slate-300 mt-1">
                {studentCount} <span className="text-sm text-slate-500 dark:text-slate-400">Students Active</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-100 dark:bg-emerald-900/20 rounded-full blur-2xl opacity-60"></div>
              <div className="flex items-center gap-3 mb-2 text-slate-600 dark:text-slate-300 font-semibold text-sm">
                <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" /> AI Adoption Index
              </div>
              <div className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                92.4%
              </div>
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                ↑ 14% from last month
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-100 dark:bg-amber-900/20 rounded-full blur-2xl opacity-60"></div>
              <div className="flex items-center gap-3 mb-2 text-slate-600 dark:text-slate-300 font-semibold text-sm">
                <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" /> Pending Approvals
              </div>
              <div className="text-4xl font-black tracking-tight" style={{ color: pendingRequests.length > 0 ? '#d97706' : 'var(--text)' }}>
                {pendingRequests.length}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
                Accounts awaiting verification
              </div>
            </div>
          </div>

          {/* Dynamic Registration Queue */}
          <div className="mb-10">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <UserCheck className="text-blue-600" size={20} />
              Pending Registration Queue
            </h3>
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                <ShieldAlert size={48} className="text-slate-300 dark:text-zinc-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No pending registration requests for this district.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-zinc-900/80">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Candidate</th>
                      <th className="px-6 py-4 font-semibold">Email Address</th>
                      <th className="px-6 py-4 font-semibold text-center">Requested Profile</th>
                      <th className="px-6 py-4 font-semibold text-center">Request Date</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                    {pendingRequests.map(req => (
                      <tr key={req.requestId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-700/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                          {req.firstName} {req.lastName}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{req.email}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 capitalize">
                            {req.requestedRole}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 flex items-center justify-end gap-2">
                          <button
                            onClick={() => void handleApprove(req)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors"
                          >
                            <UserCheck size={14} /> Approve
                          </button>
                          <button
                            onClick={() => void handleReject(req)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
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
          <div className="pt-8 border-t border-slate-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <Sparkles className="text-indigo-600" size={20} />
              Delegated Permission Matrix
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Grant or revoke AI tool access levels for roles inside your school district namespace.</p>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold w-1/4">System Roles</th>
                    {functionalPermissions.map(perm => (
                      <th key={perm} className="px-3 py-4 text-center font-bold text-indigo-900 dark:text-indigo-300">
                        {perm.replace('USE_', '').replace('GENERATE_', '').replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                  {roles.map(r => {
                    const activePerms = rolePermissions[r.roleId] || []
                    return (
                      <tr key={r.roleId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 capitalize">{r.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.description || 'No description provided'}</div>
                        </td>
                        {functionalPermissions.map(perm => {
                          const isAssigned = activePerms.includes(perm)
                          return (
                            <td key={perm} className="px-3 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => void togglePermission(r.roleId, perm)}
                                className={`inline-flex items-center justify-center p-1.5 rounded-xl transition-all ${
                                  isAssigned 
                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' 
                                    : 'text-slate-300 dark:text-zinc-600 hover:text-slate-400 dark:hover:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-800'
                                }`}
                              >
                                {isAssigned ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
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
