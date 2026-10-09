import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { 
  Shield, Building2, Activity, CheckCircle2, 
  HardDrive, AlertCircle, RefreshCw,
  Clock, Plus, Play, Pause, Sliders, Trash2,
  Users, GraduationCap, X, Calendar, Sparkles,
  Cpu, Layers, Zap, Server, Settings2, Edit3,
  KeyRound, RotateCcw, Search, AlertTriangle, Check
} from 'lucide-react'
import { useAuth } from '../../services/authService'
import { apiFetch } from '../../services/apiClient'
import { 
  listPlugins, togglePlugin, updatePluginConfig, resetCircuit, 
  setTenantOverride, probePluginHealth, 
  type PluginView, type UpdatePluginConfigRequest, type HealthProbeResult 
} from '../../services/pluginService'
import { 
  listRoles, createRole, updateRole, deleteRole, assignPermission, 
  unassignPermission, listAllPermissions, createCustomPermission, deleteCustomPermission,
  type RoleSummary, type PermissionItem 
} from '../../services/roleService'

interface TelemetryRow {
  institutionId: string
  name: string
  activeTeachers: number
  activeCandidates: number
  totalRequests: number
  promptTokens: number
  completionTokens: number
}

interface OnboardingTicket {
  ticketId: string
  districtName: string
  contactEmail: string
  requestedSubdomain: string
  status: 'PENDING' | 'APPROVED'
  createdAt: string
}

export interface TrialInstitute {
  institutionId: string
  name: string
  domain: string
  status: string
  isTrial: boolean
  trialStatus: 'active' | 'paused' | 'expired' | 'none'
  trialStartsAt?: string
  trialEndsAt?: string
  maxTeachers: number
  maxStudents: number
  activeTeachers: number
  activeStudents: number
  daysRemaining: number
  createdAt: string
}

type DashboardTab = 'infrastructure' | 'plugins' | 'rbac'

export function SuperAdminDashboard() {
  const { tokens } = useAuth()
  const accessToken = tokens?.accessToken || ''

  // Active top navigation tab synced with URL (?tab=infrastructure | plugins | rbac)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as DashboardTab | null
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (tabParam && ['infrastructure', 'plugins', 'rbac'].includes(tabParam)) {
      return tabParam
    }
    return 'infrastructure'
  })

  useEffect(() => {
    if (tabParam && ['infrastructure', 'plugins', 'rbac'].includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [tabParam, activeTab])

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  // Data states - Infrastructure & Trials
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([])
  const [trials, setTrials] = useState<TrialInstitute[]>([])
  const [onboarding, setOnboarding] = useState<OnboardingTicket[]>([
    {
      ticketId: 't1',
      districtName: 'Chicago Public Schools',
      contactEmail: 'admin@cps.edu',
      requestedSubdomain: 'cps.safescholar.net',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    },
    {
      ticketId: 't2',
      districtName: 'Austin Independent School District',
      contactEmail: 'it@austinisd.org',
      requestedSubdomain: 'austinisd.safescholar.net',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ])

  // Data states - Plugins & Resilience
  const [pluginsList, setPluginsList] = useState<PluginView[]>([])
  const [selectedPluginCategory, setSelectedPluginCategory] = useState<string>('all')
  const [pluginSearch, setPluginSearch] = useState('')
  const [selectedTenantForOverride, setSelectedTenantForOverride] = useState<string>('')
  const [editingPlugin, setEditingPlugin] = useState<PluginView | null>(null)
  const [pluginProbeResult, setPluginProbeResult] = useState<HealthProbeResult | null>(null)
  const [isProbing, setIsProbing] = useState<string | null>(null)

  // Plugin Edit Form states
  const [cfgFailureThreshold, setCfgFailureThreshold] = useState(3)
  const [cfgTimeoutSeconds, setCfgTimeoutSeconds] = useState(20)
  const [cfgCooldownSeconds, setCfgCooldownSeconds] = useState(30)
  const [cfgFallbackMode, setCfgFallbackMode] = useState('graceful_fallback')

  // Data states - Roles & Permissions
  const [rolesList, setRolesList] = useState<RoleSummary[]>([])
  const [permissionsList, setPermissionsList] = useState<PermissionItem[]>([])
  const [roleSearch, setRoleSearch] = useState('')

  // Role Modals
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newRolePerms, setNewRolePerms] = useState<string[]>([])

  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null)
  const [editRoleName, setEditRoleName] = useState('')
  const [editRoleDesc, setEditRoleDesc] = useState('')

  const [managingPermsRole, setManagingPermsRole] = useState<RoleSummary | null>(null)
  const [showCreatePermModal, setShowCreatePermModal] = useState(false)
  const [newPermName, setNewPermName] = useState('')
  const [newPermDesc, setNewPermDesc] = useState('')
  const [newPermModule, setNewPermModule] = useState('ai')

  // UI status
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Modals for Infrastructure
  const [showOnboardModal, setShowOnboardModal] = useState(false)
  const [editingTrial, setEditingTrial] = useState<TrialInstitute | null>(null)

  // Form states for Onboarding
  const [formName, setFormName] = useState('')
  const [formDomain, setFormDomain] = useState('')
  const [formAdminEmail, setFormAdminEmail] = useState('')
  const [formAdminFirstName, setFormAdminFirstName] = useState('')
  const [formAdminLastName, setFormAdminLastName] = useState('')
  const [formDurationDays, setFormDurationDays] = useState(14)
  const [formMaxTeachers, setFormMaxTeachers] = useState(10)
  const [formMaxStudents, setFormMaxStudents] = useState(100)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states for Adjusting Limits / Extension
  const [editAction, setEditAction] = useState<'extend' | 'limits'>('extend')
  const [extendDays, setExtendDays] = useState(7)
  const [editMaxTeachers, setEditMaxTeachers] = useState(10)
  const [editMaxStudents, setEditMaxStudents] = useState(100)

  async function loadData() {
    if (!accessToken) return
    setIsLoading(true)
    setErr(null)
    try {
      const [metricsRes, trialsRes, pluginsRes, rolesRes, permsRes] = await Promise.allSettled([
        apiFetch<{ telemetry?: TelemetryRow[] }>('/api/v1/dashboard/metrics', {
          method: 'GET',
          accessToken
        }),
        apiFetch<{ trials?: TrialInstitute[] }>('/api/v1/admin/trials', {
          method: 'GET',
          accessToken
        }),
        listPlugins(accessToken, selectedTenantForOverride),
        listRoles(accessToken),
        listAllPermissions(accessToken)
      ])

      if (metricsRes.status === 'fulfilled') {
        setTelemetry(metricsRes.value.telemetry || [])
      }
      if (trialsRes.status === 'fulfilled') {
        setTrials(trialsRes.value.trials || [])
      }
      if (pluginsRes.status === 'fulfilled') {
        setPluginsList(pluginsRes.value.plugins || [])
      }
      if (rolesRes.status === 'fulfilled') {
        setRolesList(rolesRes.value.roles || [])
      }
      if (permsRes.status === 'fulfilled') {
        setPermissionsList(permsRes.value.permissions || [])
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load console data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [accessToken, selectedTenantForOverride])

  // --- TRIAL HANDLERS ---
  async function handleOnboardTrial(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) {
      setErr('Institute name is required')
      return
    }
    setIsSubmitting(true)
    setErr(null)
    setOk(null)
    try {
      await apiFetch('/api/v1/admin/trials/onboard', {
        method: 'POST',
        accessToken,
        body: {
          name: formName.trim(),
          domain: formDomain.trim(),
          adminEmail: formAdminEmail.trim(),
          adminFirstName: formAdminFirstName.trim(),
          adminLastName: formAdminLastName.trim(),
          durationDays: formDurationDays,
          maxTeachers: formMaxTeachers,
          maxStudents: formMaxStudents
        }
      })
      setOk(`Trial institute "${formName}" onboarded successfully for ${formDurationDays} days!`)
      setShowOnboardModal(false)
      setFormName('')
      setFormDomain('')
      setFormAdminEmail('')
      setFormAdminFirstName('')
      setFormAdminLastName('')
      setFormDurationDays(14)
      setFormMaxTeachers(10)
      setFormMaxStudents(100)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to onboard trial institute')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleTrial(inst: TrialInstitute, action: 'pause' | 'resume' | 'delete') {
    if (action === 'delete' && !confirm(`Are you sure you want to revoke and delete trial for "${inst.name}"?`)) {
      return
    }
    setErr(null)
    setOk(null)
    try {
      await apiFetch('/api/v1/admin/trials/toggle', {
        method: 'POST',
        accessToken,
        body: {
          institutionId: inst.institutionId,
          action
        }
      })
      const actionText = action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'deleted'
      setOk(`Trial institute "${inst.name}" ${actionText} successfully.`)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : `Failed to ${action} trial`)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTrial) return
    setIsSubmitting(true)
    setErr(null)
    setOk(null)
    try {
      if (editAction === 'extend') {
        await apiFetch('/api/v1/admin/trials/toggle', {
          method: 'POST',
          accessToken,
          body: {
            institutionId: editingTrial.institutionId,
            action: 'extend',
            additionalDays: extendDays
          }
        })
        setOk(`Trial extended by +${extendDays} days for "${editingTrial.name}".`)
      } else {
        await apiFetch('/api/v1/admin/trials/toggle', {
          method: 'POST',
          accessToken,
          body: {
            institutionId: editingTrial.institutionId,
            action: 'update_limits',
            maxTeachers: editMaxTeachers,
            maxStudents: editMaxStudents
          }
        })
        setOk(`Quotas updated for "${editingTrial.name}": Max ${editMaxTeachers} Teachers, Max ${editMaxStudents} Students.`)
      }
      setEditingTrial(null)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update trial')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- PLUGIN & RESILIENCE HANDLERS ---
  async function handleTogglePlugin(plugin: PluginView) {
    setErr(null)
    setOk(null)
    try {
      if (selectedTenantForOverride) {
        // Toggle tenant override
        const currentVal = plugin.tenantOverride !== undefined ? plugin.tenantOverride : plugin.enabled
        await setTenantOverride(accessToken, selectedTenantForOverride, plugin.id, !currentVal)
        setOk(`Tenant override updated: ${plugin.name} is now ${!currentVal ? 'ENABLED' : 'DISABLED'} for selected tenant.`)
      } else {
        // Toggle globally
        await togglePlugin(accessToken, plugin.id, !plugin.enabled)
        setOk(`Feature plugin "${plugin.name}" ${!plugin.enabled ? 'activated' : 'deactivated'} globally.`)
      }
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to toggle plugin state')
    }
  }

  async function handleResetCircuit(pluginId: string, pluginName: string) {
    setErr(null)
    setOk(null)
    try {
      await resetCircuit(accessToken, pluginId)
      setOk(`Circuit breaker reset to CLOSED state for "${pluginName}". Canary probes enabled.`)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to reset circuit breaker')
    }
  }

  async function handleProbePlugin(pluginId: string) {
    setIsProbing(pluginId)
    setPluginProbeResult(null)
    try {
      const res = await probePluginHealth(accessToken, pluginId)
      setPluginProbeResult(res)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Health probe failed')
    } finally {
      setIsProbing(null)
    }
  }

  function openPluginConfig(plugin: PluginView) {
    setEditingPlugin(plugin)
    setCfgFailureThreshold(plugin.failureThreshold)
    setCfgTimeoutSeconds(plugin.timeoutSeconds)
    setCfgCooldownSeconds(plugin.cooldownSeconds)
    setCfgFallbackMode(plugin.fallbackMode)
  }

  async function handleSavePluginConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPlugin) return
    setIsSubmitting(true)
    setErr(null)
    setOk(null)
    try {
      const req: UpdatePluginConfigRequest = {
        pluginId: editingPlugin.id,
        failureThreshold: cfgFailureThreshold,
        timeoutSeconds: cfgTimeoutSeconds,
        cooldownSeconds: cfgCooldownSeconds,
        fallbackMode: cfgFallbackMode
      }
      await updatePluginConfig(accessToken, req)
      setOk(`Resilience configuration updated for "${editingPlugin.name}".`)
      setEditingPlugin(null)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update plugin configuration')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- ROLE & PERMISSION HANDLERS ---
  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoleName.trim()) {
      setErr('Role name is required')
      return
    }
    setIsSubmitting(true)
    setErr(null)
    setOk(null)
    try {
      const res = await createRole(accessToken, newRoleName.trim(), newRoleDesc.trim())
      // Assign selected permissions
      for (const p of newRolePerms) {
        try {
          await assignPermission(accessToken, res.roleId, p)
        } catch {}
      }
      setOk(`Role "${newRoleName}" created successfully with ${newRolePerms.length} permissions!`)
      setShowCreateRoleModal(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setNewRolePerms([])
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create role')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveRoleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingRole) return
    setIsSubmitting(true)
    setErr(null)
    setOk(null)
    try {
      await updateRole(accessToken, editingRole.roleId, editRoleName.trim(), editRoleDesc.trim())
      setOk(`Role "${editRoleName}" updated successfully.`)
      setEditingRole(null)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteRole(role: RoleSummary) {
    if (!confirm(`Are you sure you want to delete custom role "${role.name}"?`)) return
    setErr(null)
    setOk(null)
    try {
      await deleteRole(accessToken, role.roleId)
      setOk(`Role "${role.name}" deleted successfully.`)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete role')
    }
  }

  async function handleToggleRolePermission(role: RoleSummary, permCode: string, hasPerm: boolean) {
    setErr(null)
    setOk(null)
    try {
      if (hasPerm) {
        await unassignPermission(accessToken, role.roleId, permCode)
        setOk(`Revoked "${permCode}" from role "${role.name}".`)
      } else {
        await assignPermission(accessToken, role.roleId, permCode)
        setOk(`Granted "${permCode}" to role "${role.name}".`)
      }
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update role permission')
    }
  }

  async function handleCreateCustomPermission(e: React.FormEvent) {
    e.preventDefault()
    if (!newPermName.trim()) {
      setErr('Permission name is required')
      return
    }
    setIsSubmitting(true)
    setErr(null)
    setOk(null)
    try {
      await createCustomPermission(accessToken, newPermName.trim(), newPermDesc.trim(), newPermModule.trim())
      setOk(`Custom permission "${newPermName.toUpperCase()}" registered successfully!`)
      setShowCreatePermModal(false)
      setNewPermName('')
      setNewPermDesc('')
      setNewPermModule('ai')
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create permission')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteCustomPermission(permName: string) {
    if (!confirm(`Are you sure you want to delete permission "${permName}"?`)) return
    setErr(null)
    setOk(null)
    try {
      await deleteCustomPermission(accessToken, permName)
      setOk(`Permission "${permName}" deleted successfully.`)
      void loadData()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete permission')
    }
  }

  // Filtered lists
  const trialList = trials.filter(t => t.isTrial)
  const activeTrialCount = trialList.filter(t => t.trialStatus === 'active').length

  const filteredPlugins = useMemo(() => {
    return pluginsList.filter(p => {
      const matchesCat = selectedPluginCategory === 'all' || p.category === selectedPluginCategory
      const matchesSearch = !pluginSearch.trim() || 
        p.name.toLowerCase().includes(pluginSearch.toLowerCase()) || 
        p.id.toLowerCase().includes(pluginSearch.toLowerCase()) ||
        p.description.toLowerCase().includes(pluginSearch.toLowerCase())
      return matchesCat && matchesSearch
    })
  }, [pluginsList, selectedPluginCategory, pluginSearch])

  const filteredRoles = useMemo(() => {
    return rolesList.filter(r => {
      return !roleSearch.trim() || 
        r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
        r.description.toLowerCase().includes(roleSearch.toLowerCase())
    })
  }, [rolesList, roleSearch])

  // Permissions grouped by module
  const permissionsByModule = useMemo(() => {
    const map: Record<string, PermissionItem[]> = {}
    for (const p of permissionsList) {
      const mod = p.module || 'general'
      if (!map[mod]) map[mod] = []
      map[mod].push(p)
    }
    return map
  }, [permissionsList])

  // Plugin statistics
  const pluginMetrics = useMemo(() => {
    const total = pluginsList.length
    const openCircuits = pluginsList.filter(p => p.circuitState === 'OPEN').length
    const degraded = pluginsList.filter(p => p.status === 'degraded' || p.circuitState === 'HALF_OPEN').length
    const active = pluginsList.filter(p => p.enabled && p.circuitState === 'CLOSED').length
    const totalRequests = pluginsList.reduce((sum, p) => sum + p.totalRequests, 0)
    const totalErrors = pluginsList.reduce((sum, p) => sum + p.totalFailures, 0)
    const errRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : '0.0'
    return { total, openCircuits, degraded, active, totalRequests, totalErrors, errRate }
  }, [pluginsList])

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card shadow-lg border border-slate-200/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden">
        <div className="cardInner p-4 sm:p-6 md:p-8">
          
          {/* Executive Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5 sm:pb-6 mb-6">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-800 to-purple-900 text-white shadow-lg shrink-0">
                <Shield size={24} className="sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex flex-wrap items-center gap-2">
                  <span>Enterprise Core Architecture &amp; Governance</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                    Super Admin Console
                  </span>
                </h2>
                <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Decoupled microservices, fault-tolerant plugins, circuit breakers, granular roles, and tenant governance.
                </div>
              </div>
            </div>

            <button
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm self-end sm:self-center shrink-0"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Systems
            </button>
          </div>

          {err ? <div className="toast toastError mb-4 flex items-center gap-2"><AlertTriangle size={16} /> {err}</div> : null}
          {ok ? <div className="toast toastOk mb-4 flex items-center gap-2"><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-zinc-800 mb-6 gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => handleTabChange('infrastructure')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'infrastructure'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Building2 size={16} />
              <span>Infrastructure &amp; Trials</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                {trials.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('plugins')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'plugins'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Cpu size={16} />
              <span>Core Plugins &amp; Resilience Mesh</span>
              {pluginMetrics.openCircuits > 0 ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-black animate-pulse">
                  {pluginMetrics.openCircuits} Open
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                  {pluginMetrics.total}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('rbac')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'rbac'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <KeyRound size={16} />
              <span>Granular Roles &amp; Permissions</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                {rolesList.length} Roles
              </span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: INFRASTRUCTURE & TRIAL ONBOARDING (Preserved)       */}
          {/* ======================================================== */}
          {activeTab === 'infrastructure' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              {/* Quick Metrics - 6 Global Governance Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3.5 lg:gap-4 mb-6 sm:mb-8">
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 sm:p-4 shadow-sm min-w-0 flex flex-col justify-between">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 mb-1 truncate">
                    <Building2 size={15} className="text-indigo-500 shrink-0" />
                    <span className="truncate">Institutes</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white truncate">
                    {Math.max(trials.length, telemetry.length)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">Total enrolled</div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 sm:p-4 shadow-sm min-w-0 flex flex-col justify-between">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 mb-1 truncate">
                    <Users size={15} className="text-blue-500 shrink-0" />
                    <span className="truncate">Teachers</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white truncate">
                    {trials.reduce((sum, t) => sum + (t.activeTeachers || 0), 0) || telemetry.reduce((sum, t) => sum + (t.activeTeachers || 0), 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">Active staff</div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 sm:p-4 shadow-sm min-w-0 flex flex-col justify-between">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 mb-1 truncate">
                    <GraduationCap size={15} className="text-emerald-500 shrink-0" />
                    <span className="truncate">Students</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white truncate">
                    {trials.reduce((sum, t) => sum + (t.activeStudents || 0), 0) || telemetry.reduce((sum, t) => sum + (t.activeCandidates || 0), 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">Active learners</div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200/60 dark:border-indigo-800/60 p-3 sm:p-4 shadow-sm min-w-0 flex flex-col justify-between">
                  <div className="text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 mb-1 truncate">
                    <Clock size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">Trials</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-indigo-900 dark:text-indigo-100 truncate">
                    {activeTrialCount} <span className="text-xs font-medium text-slate-500">/ {trialList.length}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">7-30d access</div>
                </div>
                
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 sm:p-4 shadow-sm min-w-0 flex flex-col justify-between">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 mb-1 truncate">
                    <HardDrive size={15} className="text-blue-500 shrink-0" />
                    <span className="truncate">AI Requests</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white truncate">
                    {telemetry.reduce((sum, t) => sum + (t.totalRequests || 0), 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">reqs / hour</div>
                </div>
                
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 sm:p-4 shadow-sm min-w-0 flex flex-col justify-between">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 mb-1 truncate">
                    <Activity size={15} className="text-amber-500 shrink-0" />
                    <span className="truncate">AI Tokens</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white truncate">
                    {telemetry.reduce((sum, t) => sum + (t.promptTokens || 0) + (t.completionTokens || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">Tokens used</div>
                </div>
              </div>

              {/* Trial Onboarding Section */}
              <div className="mb-8 sm:mb-10 p-4 sm:p-6 lg:p-7 rounded-3xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/80 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 sm:mb-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                      <Sparkles size={20} className="text-amber-500 shrink-0" />
                      <span>Trial Onboarding &amp; Institutional Governance</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Onboard pilot institutions with time-bounded access (7 to 30 days) and enforce strict quotas on onboarded teachers and students.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowOnboardModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all shrink-0"
                  >
                    <Plus size={16} /> Onboard Trial Institute
                  </button>
                </div>

                {trialList.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-700 text-center text-slate-500">
                    <Building2 size={36} className="mx-auto text-slate-400 mb-2 opacity-50" />
                    <div className="font-semibold text-sm">No trial institutes currently onboarded.</div>
                    <div className="text-xs text-slate-400 mt-1">Click "Onboard Trial Institute" above to provision a limited-time trial (7-30 days) with teacher and student limits.</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm scrollbar-thin">
                    <table className="w-full text-xs sm:text-sm text-left">
                      <thead className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100/70 dark:bg-zinc-800/80 tracking-wider">
                        <tr>
                          <th className="px-3.5 sm:px-4 py-3 font-semibold">Institute &amp; Domain</th>
                          <th className="px-3 sm:px-4 py-3 font-semibold text-center whitespace-nowrap">Trial Status</th>
                          <th className="px-3 sm:px-4 py-3 font-semibold text-center whitespace-nowrap">Remaining</th>
                          <th className="px-3 sm:px-4 py-3 font-semibold text-center whitespace-nowrap">Teacher Quota</th>
                          <th className="px-3 sm:px-4 py-3 font-semibold text-center whitespace-nowrap">Student Quota</th>
                          <th className="px-3 sm:px-4 py-3 font-semibold text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                        {trialList.map(inst => {
                          const teacherPct = Math.min(100, Math.round((inst.activeTeachers / (inst.maxTeachers || 1)) * 100))
                          const studentPct = Math.min(100, Math.round((inst.activeStudents / (inst.maxStudents || 1)) * 100))
                          const isExpired = inst.trialStatus === 'expired'
                          const isPaused = inst.trialStatus === 'paused'
                          const isActive = inst.trialStatus === 'active'

                          return (
                            <tr key={inst.institutionId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                              <td className="px-3.5 sm:px-4 py-3.5">
                                <div className="font-bold text-slate-900 dark:text-slate-100 leading-snug">{inst.name}</div>
                                <div className="text-[11px] sm:text-xs text-slate-500 font-mono mt-0.5">{inst.domain || 'Direct Access'}</div>
                              </td>
                              <td className="px-3 sm:px-4 py-3.5 text-center whitespace-nowrap">
                                {isActive && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active Trial
                                  </span>
                                )}
                                {isPaused && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                    Paused
                                  </span>
                                )}
                                {isExpired && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                    Expired
                                  </span>
                                )}
                              </td>
                              <td className="px-3 sm:px-4 py-3.5 text-center whitespace-nowrap font-medium">
                                {isExpired ? (
                                  <span className="text-xs text-rose-500 font-semibold">Ended</span>
                                ) : isPaused ? (
                                  <span className="text-xs text-amber-500 font-semibold">Suspended</span>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                                      {inst.daysRemaining} days left
                                    </span>
                                    {inst.trialEndsAt && (
                                      <span className="text-[10px] text-slate-400">
                                        Ends {new Date(inst.trialEndsAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              {/* Teacher Quota */}
                              <td className="px-3 sm:px-4 py-3.5 text-center whitespace-nowrap">
                                <div className="flex flex-col items-center gap-1 min-w-[95px] max-w-[120px] mx-auto">
                                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Users size={12} className="text-indigo-500" />
                                    {inst.activeTeachers} / {inst.maxTeachers}
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all ${
                                        teacherPct >= 100 ? 'bg-rose-500' : teacherPct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'
                                      }`}
                                      style={{ width: `${teacherPct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              {/* Student Quota */}
                              <td className="px-3 sm:px-4 py-3.5 text-center whitespace-nowrap">
                                <div className="flex flex-col items-center gap-1 min-w-[95px] max-w-[120px] mx-auto">
                                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <GraduationCap size={12} className="text-blue-500" />
                                    {inst.activeStudents} / {inst.maxStudents}
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all ${
                                        studentPct >= 100 ? 'bg-rose-500' : studentPct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${studentPct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              {/* Action Buttons */}
                              <td className="px-3 sm:px-4 py-3.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  {isActive ? (
                                    <button
                                      onClick={() => void handleToggleTrial(inst, 'pause')}
                                      title="Pause Trial Access"
                                      className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 transition-colors"
                                    >
                                      <Pause size={13} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => void handleToggleTrial(inst, 'resume')}
                                      title="Resume Trial Access"
                                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 transition-colors"
                                    >
                                      <Play size={13} />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setEditingTrial(inst)
                                      setEditAction('extend')
                                      setExtendDays(7)
                                    }}
                                    title="Extend Duration"
                                    className="px-2 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 transition-colors"
                                  >
                                    + Extend
                                  </button>

                                  <button
                                    onClick={() => {
                                      setEditingTrial(inst)
                                      setEditAction('limits')
                                      setEditMaxTeachers(inst.maxTeachers)
                                      setEditMaxStudents(inst.maxStudents)
                                    }}
                                    title="Adjust Quotas"
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-slate-300 transition-colors"
                                  >
                                    <Sliders size={13} />
                                  </button>

                                  <button
                                    onClick={() => void handleToggleTrial(inst, 'delete')}
                                    title="Revoke & Delete Trial"
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pending Tenant Requests */}
              <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-200 dark:border-zinc-800">
                <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" /> Pending Tenant Requests
                </h3>
                
                {onboarding.length === 0 ? (
                  <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 text-center text-slate-500 font-medium">
                    No pending tenant activation tickets.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl">
                    <table className="w-full text-sm text-left whitespace-nowrap min-w-[650px]">
                      <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-zinc-900/80">
                        <tr>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold">School District Name</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold">Contact Domain Address</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Requested Subdomain</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Requested Date</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                        {onboarding.map(ticket => (
                          <tr key={ticket.ticketId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-700/30 transition-colors">
                            <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-slate-900 dark:text-slate-100">{ticket.districtName}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-slate-600 dark:text-slate-300">{ticket.contactEmail}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center font-mono text-blue-600 dark:text-blue-400">
                              {ticket.requestedSubdomain}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center text-slate-500 dark:text-slate-400">
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                              <button
                                onClick={() => {
                                  setOnboarding(prev => prev.filter(t => t.ticketId !== ticket.ticketId))
                                  setOk(`Authorized ticket for ${ticket.districtName}. You can now provision it under the Trial Console.`)
                                }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                              >
                                <Building2 size={14} /> Authorize
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* System Volumetric Load Analyzer */}
              <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={18} className="text-emerald-500" /> System Volumetric Load
                  </h3>
                </div>

                {telemetry.length === 0 ? (
                  <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 text-center text-slate-500 font-medium">
                    No active tenants detected in the telemetry stream.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl">
                    <table className="w-full text-sm text-left whitespace-nowrap min-w-[760px]">
                      <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-zinc-900/80">
                        <tr>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold">Tenant Name</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Active Teachers</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Active Candidates</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Request Count</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Prompt Tokens</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Completion Tokens</th>
                          <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-center">Total Load</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                        {telemetry.map(row => (
                          <tr key={row.institutionId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-700/30 transition-colors">
                            <td className="px-4 sm:px-6 py-3 sm:py-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{row.name}</div>
                              <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {row.institutionId}</div>
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center font-medium text-slate-700 dark:text-slate-300">{row.activeTeachers}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center font-medium text-slate-700 dark:text-slate-300">{row.activeCandidates}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center font-bold text-slate-900 dark:text-white">{row.totalRequests}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center text-slate-500 dark:text-slate-400">{row.promptTokens.toLocaleString()}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center text-slate-500 dark:text-slate-400">{row.completionTokens.toLocaleString()}</td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                              {(row.promptTokens + row.completionTokens).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CORE PLUGINS & RESILIENCE MESH                     */}
          {/* ======================================================== */}
          {activeTab === 'plugins' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              {/* Resilience Health KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
                <div className="rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3.5 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                    <Layers size={14} className="text-indigo-500" /> Total Plugins
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{pluginMetrics.total}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Registered features</div>
                </div>

                <div className="rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 p-3.5 shadow-sm">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5 mb-1">
                    <CheckCircle2 size={14} className="text-emerald-500" /> Healthy &amp; Active
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-200">{pluginMetrics.active}</div>
                  <div className="text-[10px] text-emerald-600/70 mt-0.5">Circuit closed (100%)</div>
                </div>

                <div className="rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/60 p-3.5 shadow-sm">
                  <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1.5 mb-1">
                    <Zap size={14} className="text-rose-500" /> Tripped Circuits
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-800 dark:text-rose-200">{pluginMetrics.openCircuits}</div>
                  <div className="text-[10px] text-rose-600/70 mt-0.5">Failing / Isolated</div>
                </div>

                <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/60 p-3.5 shadow-sm">
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={14} className="text-amber-500" /> Degraded / Probe
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-200">{pluginMetrics.degraded}</div>
                  <div className="text-[10px] text-amber-600/70 mt-0.5">Half-open or fallback</div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3.5 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                    <Server size={14} className="text-blue-500" /> Total Invocations
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{pluginMetrics.totalRequests}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Resilient executions</div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3.5 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                    <Activity size={14} className="text-purple-500" /> Error Rate
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{pluginMetrics.errRate}%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{pluginMetrics.totalErrors} caught errors</div>
                </div>
              </div>

              {/* Filtering & Controls Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                {/* Search */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search feature plugins by name, ID or description..."
                    value={pluginSearch}
                    onChange={e => setPluginSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Category filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
                  {[
                    { id: 'all', label: 'All Modules' },
                    { id: 'ai_education', label: 'AI Workspace' },
                    { id: 'microservice', label: 'Microservices' },
                    { id: 'integration', label: 'Integration' },
                    { id: 'governance', label: 'Governance' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedPluginCategory(cat.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                        selectedPluginCategory === cat.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 hover:border-indigo-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Tenant Scope Selector for Granular Overrides */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Tenant Scope:</span>
                  <select
                    value={selectedTenantForOverride}
                    onChange={e => setSelectedTenantForOverride(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Global (All Tenants)</option>
                    {trials.map(inst => (
                      <option key={inst.institutionId} value={inst.institutionId}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Health Probe Modal / Banner */}
              {pluginProbeResult && (
                <div className={`p-4 rounded-2xl mb-5 flex items-center justify-between border ${
                  pluginProbeResult.healthy 
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {pluginProbeResult.healthy ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-rose-500" />}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">
                        Connectivity Probe Result: {pluginProbeResult.healthy ? 'HEALTHY' : 'UNREACHABLE'}
                      </div>
                      <div className="text-sm font-medium mt-0.5">
                        {pluginProbeResult.detail} (Latency: {pluginProbeResult.latencyMs}ms | Circuit State: {pluginProbeResult.circuitState})
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPluginProbeResult(null)}
                    className="text-xs font-semibold px-2 py-1 rounded bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Plugin Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlugins.map(plugin => {
                  const isCircuitOpen = plugin.circuitState === 'OPEN'
                  const isHalfOpen = plugin.circuitState === 'HALF_OPEN'
                  const isEffectiveEnabled = plugin.tenantOverride !== undefined ? plugin.tenantOverride : plugin.enabled

                  return (
                    <div 
                      key={plugin.id}
                      className={`relative rounded-3xl p-5 border transition-all shadow-sm flex flex-col justify-between ${
                        !isEffectiveEnabled
                          ? 'bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800 opacity-70'
                          : isCircuitOpen
                          ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80 shadow-rose-500/5'
                          : 'bg-white dark:bg-zinc-850 border-slate-200/80 dark:border-zinc-700/80 hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Header: Name, Category, Circuit Badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400">
                              {plugin.category.replace('_', ' ')}
                            </span>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-1.5">
                              <span>{plugin.name}</span>
                              {plugin.tenantOverride !== undefined && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                  Tenant Custom
                                </span>
                              )}
                            </h4>
                          </div>

                          {/* Circuit Breaker State Badge */}
                          <div className="text-right">
                            {isCircuitOpen ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                CIRCUIT OPEN
                              </span>
                            ) : isHalfOpen ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                CANARY PROBING
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                CIRCUIT CLOSED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                          {plugin.description}
                        </p>

                        {/* Technical Metadata */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-[11px] mb-4">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Target Service:</span>
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 truncate block">
                              {plugin.targetService}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Permission:</span>
                            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 truncate block">
                              {plugin.requiredPermission || 'Public'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fail Threshold:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {plugin.failureThreshold} errors ({plugin.timeoutSeconds}s t/o)
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fallback Mode:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                              {plugin.fallbackMode.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Real-time stats */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pb-3 mb-3 border-b border-slate-100 dark:border-zinc-800">
                          <div>
                            <span>Reqs: </span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{plugin.totalRequests}</span>
                          </div>
                          <div>
                            <span>Consec. Fails: </span>
                            <span className={`font-bold ${plugin.consecutiveFailures > 0 ? 'text-rose-500 font-extrabold' : 'text-slate-700 dark:text-slate-200'}`}>
                              {plugin.consecutiveFailures}
                            </span>
                          </div>
                          <div>
                            <span>Avg Latency: </span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{plugin.avgLatencyMs.toFixed(0)}ms</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {/* Toggle Enable/Disable Button */}
                        <button
                          onClick={() => void handleTogglePlugin(plugin)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isEffectiveEnabled
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-slate-300'
                          }`}
                        >
                          {isEffectiveEnabled ? <Check size={13} /> : <X size={13} />}
                          <span>{isEffectiveEnabled ? 'Enabled' : 'Disabled'}</span>
                        </button>

                        <div className="inline-flex items-center gap-1.5">
                          {/* Reset Circuit (if open) */}
                          {isCircuitOpen && (
                            <button
                              onClick={() => void handleResetCircuit(plugin.id, plugin.name)}
                              title="Reset Tripped Circuit"
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1 transition-all"
                            >
                              <RotateCcw size={12} /> Reset
                            </button>
                          )}

                          {/* Health Probe */}
                          <button
                            onClick={() => void handleProbePlugin(plugin.id)}
                            disabled={isProbing === plugin.id}
                            title="Probe Upstream Connectivity"
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-slate-300 transition-colors"
                          >
                            <Activity size={13} className={isProbing === plugin.id ? 'animate-spin' : ''} />
                          </button>

                          {/* Configure Resilience */}
                          <button
                            onClick={() => openPluginConfig(plugin)}
                            title="Configure Fault-Tolerance &amp; Fallbacks"
                            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition-colors"
                          >
                            <Settings2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: GRANULAR ROLES & PERMISSIONS CONSOLE                */}
          {/* ======================================================== */}
          {activeTab === 'rbac' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              {/* Header & Create Role Action */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound size={20} className="text-indigo-500" />
                    <span>Granular Role &amp; Permission Governance</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Create custom administrative and pedagogical roles, map fine-grained permission scopes, and protect privilege isolation.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={() => setShowCreatePermModal(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 shadow-sm transition-all"
                  >
                    <Plus size={15} /> New Permission
                  </button>
                  <button
                    onClick={() => setShowCreateRoleModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md transition-all"
                  >
                    <Plus size={16} /> Create Role
                  </button>
                </div>
              </div>

              {/* Role Search Bar */}
              <div className="relative mb-4 max-w-md">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter roles by name or description..."
                  value={roleSearch}
                  onChange={e => setRoleSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Roles Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm scrollbar-thin mb-8">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100/70 dark:bg-zinc-800/80 tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Role Name</th>
                      <th className="px-4 py-3 font-semibold">Scope &amp; Description</th>
                      <th className="px-4 py-3 font-semibold text-center">Assigned Users</th>
                      <th className="px-4 py-3 font-semibold">Granted Permissions</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                    {filteredRoles.map(role => (
                      <tr key={role.roleId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{role.name}</span>
                            {role.isSystem ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700">
                                System
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs">
                          <div className="text-xs">{role.description || 'No description provided.'}</div>
                          {role.institutionId && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Tenant: {role.institutionId}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                          {role.userCount || 0}
                        </td>
                        <td className="px-4 py-3.5 max-w-md">
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin">
                            {role.permissions && role.permissions.length > 0 ? (
                              role.permissions.map(p => (
                                <span key={p} className="text-[10px] px-2 py-0.5 rounded-md font-mono font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">No permissions assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setManagingPermsRole(role)}
                              title="Configure Granular Permissions"
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-300 transition-colors"
                            >
                              Permissions
                            </button>
                            {!role.isSystem && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingRole(role)
                                    setEditRoleName(role.name)
                                    setEditRoleDesc(role.description || '')
                                  }}
                                  title="Edit Role Metadata"
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-slate-300 transition-colors"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() => void handleDeleteRole(role)}
                                  title="Delete Custom Role"
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Permissions Catalog Section */}
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/80 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <KeyRound size={16} className="text-indigo-500" /> Granular Permissions Catalog
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  All active capability tokens enforced by the Policy Engine across SafeScholar modules.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(permissionsByModule).map(([mod, perms]) => (
                    <div key={mod} className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2 border-b pb-1 dark:border-zinc-800">
                        Module: {mod} ({perms.length})
                      </div>
                      <div className="space-y-2">
                        {perms.map(p => (
                          <div key={p.permissionId} className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                              <div className="text-[11px] text-slate-500 leading-tight">{p.description}</div>
                            </div>
                            {p.module === 'custom' && (
                              <button
                                onClick={() => void handleDeleteCustomPermission(p.name)}
                                className="text-rose-500 hover:text-rose-700 p-1"
                                title="Delete Custom Permission"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: Configure Plugin Resilience & Fault Tolerance      */}
      {/* ======================================================== */}
      <AnimatePresence>
        {editingPlugin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Resilience &amp; Circuit Settings</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{editingPlugin.name} ({editingPlugin.id})</p>
                </div>
                <button
                  onClick={() => setEditingPlugin(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePluginConfig} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Consecutive Failure Threshold (Before Circuit Opens)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={cfgFailureThreshold}
                      onChange={e => setCfgFailureThreshold(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="font-extrabold text-sm text-indigo-600 w-8">{cfgFailureThreshold}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Trips circuit after {cfgFailureThreshold} errors to protect core platform.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Execution Timeout (Seconds)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={cfgTimeoutSeconds}
                      onChange={e => setCfgTimeoutSeconds(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="font-extrabold text-sm text-indigo-600 w-8">{cfgTimeoutSeconds}s</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Circuit Cooldown (Seconds Before Canary Half-Open)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="120"
                      value={cfgCooldownSeconds}
                      onChange={e => setCfgCooldownSeconds(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <span className="font-extrabold text-sm text-indigo-600 w-8">{cfgCooldownSeconds}s</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Fault Fallback Strategy
                  </label>
                  <select
                    value={cfgFallbackMode}
                    onChange={e => setCfgFallbackMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="graceful_fallback">Graceful Educational Fallback (Australian Curriculum)</option>
                    <option value="offline_template">Offline Template Delivery</option>
                    <option value="fail_fast">Fail-Fast (Immediate 503 without wait)</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingPlugin(null)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: Create New Role with Module-Grouped Checkboxes     */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showCreateRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Create Custom Role</h3>
                    <p className="text-xs text-slate-500">Define role capabilities and assign granular permission scopes.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateRoleModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateRole} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. curriculum_coordinator or head_of_department"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describe the administrative or teaching responsibilities..."
                    value={newRoleDesc}
                    onChange={e => setNewRoleDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Assign Granular Permissions ({newRolePerms.length} selected)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (newRolePerms.length === permissionsList.length) setNewRolePerms([])
                        else setNewRolePerms(permissionsList.map(p => p.name))
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                      {newRolePerms.length === permissionsList.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                    {Object.entries(permissionsByModule).map(([mod, perms]) => (
                      <div key={mod} className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                          Module: {mod}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {perms.map(p => {
                            const isChecked = newRolePerms.includes(p.name)
                            return (
                              <label key={p.name} className="flex items-center gap-2 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) setNewRolePerms(prev => [...prev, p.name])
                                    else setNewRolePerms(prev => prev.filter(x => x !== p.name))
                                  }}
                                  className="rounded accent-indigo-600"
                                />
                                <span className="font-mono truncate" title={p.description}>{p.name}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateRoleModal(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Role'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: Manage Permissions for Existing Role              */}
      {/* ======================================================== */}
      <AnimatePresence>
        {managingPermsRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    Permissions: {managingPermsRole.name}
                  </h3>
                  <p className="text-xs text-slate-500">Toggle individual permissions for this role.</p>
                </div>
                <button
                  onClick={() => setManagingPermsRole(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                {Object.entries(permissionsByModule).map(([mod, perms]) => (
                  <div key={mod} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                      Module: {mod}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map(p => {
                        const hasPerm = managingPermsRole.permissions?.includes(p.name) || false
                        return (
                          <div 
                            key={p.name}
                            onClick={() => void handleToggleRolePermission(managingPermsRole, p.name, hasPerm)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              hasPerm 
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200' 
                                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-750 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-bold truncate">{p.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{p.description}</div>
                            </div>
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              hasPerm ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-zinc-600'
                            }`}>
                              {hasPerm && <Check size={12} />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={() => setManagingPermsRole(null)}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: Edit Role Metadata                                */}
      {/* ======================================================== */}
      <AnimatePresence>
        {editingRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Role Details</h3>
                <button onClick={() => setEditingRole(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveRoleEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editRoleName}
                    onChange={e => setEditRoleName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editRoleDesc}
                    onChange={e => setEditRoleDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: Register Custom Permission                        */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showCreatePermModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Register New Permission</h3>
                <button onClick={() => setShowCreatePermModal(false)} className="p-1.5 rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreateCustomPermission} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Permission Code * (Uppercase)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EXPORT_DISTRICT_ANALYTICS"
                    value={newPermName}
                    onChange={e => setNewPermName(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Module Group
                  </label>
                  <select
                    value={newPermModule}
                    onChange={e => setNewPermModule(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ai">AI Workspace</option>
                    <option value="core">Core Governance</option>
                    <option value="users">User Operations</option>
                    <option value="assessment">Assessment</option>
                    <option value="worksheet">Worksheet</option>
                    <option value="integration">LMS Integration</option>
                    <option value="custom">Custom Module</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What capability does this permission grant?"
                    value={newPermDesc}
                    onChange={e => setNewPermDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreatePermModal(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                  >
                    {isSubmitting ? 'Creating...' : 'Register'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: Onboard Trial Institute (Preserved)                */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showOnboardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Onboard Trial Institute</h3>
                    <p className="text-xs text-slate-500">Configure time-limited trial access with teacher/student quotas.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOnboardModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleOnboardTrial} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Institute Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Springfield High School"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Domain / Subdomain (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. springfield.edu or leave blank for auto-slug"
                    value={formDomain}
                    onChange={e => setFormDomain(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Duration Selector (7 to 30 days) */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={14} /> Trial Duration (7 - 30 Days)
                    </label>
                    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                      {formDurationDays} Days
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[7, 14, 21, 30].map(d => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setFormDurationDays(d)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          formDurationDays === d
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-700 hover:border-indigo-300'
                        }`}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="7"
                    max="30"
                    step="1"
                    value={formDurationDays}
                    onChange={e => setFormDurationDays(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Quota Limits */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Users size={12} className="text-indigo-500" /> Max Teachers
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formMaxTeachers}
                      onChange={e => setFormMaxTeachers(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <GraduationCap size={12} className="text-blue-500" /> Max Students
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={formMaxStudents}
                      onChange={e => setFormMaxStudents(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Initial Admin Account */}
                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                    Initial Institute Admin Account (Optional)
                  </span>
                  <div className="space-y-2">
                    <input
                      type="email"
                      placeholder="admin@school.edu"
                      value={formAdminEmail}
                      onChange={e => setFormAdminEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="First Name"
                        value={formAdminFirstName}
                        onChange={e => setFormAdminFirstName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Last Name"
                        value={formAdminLastName}
                        onChange={e => setFormAdminLastName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                  >
                    {isSubmitting ? 'Onboarding...' : 'Confirm & Onboard'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: Extend Trial or Adjust Quotas (Preserved)         */}
      {/* ======================================================== */}
      <AnimatePresence>
        {editingTrial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {editAction === 'extend' ? 'Extend Trial Duration' : 'Adjust Member Quotas'}
                  </h3>
                  <p className="text-xs text-slate-500">{editingTrial.name}</p>
                </div>
                <button
                  onClick={() => setEditingTrial(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                <button
                  type="button"
                  onClick={() => setEditAction('extend')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    editAction === 'extend' 
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-zinc-900' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Extend Days
                </button>
                <button
                  type="button"
                  onClick={() => setEditAction('limits')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    editAction === 'limits' 
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-zinc-900' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Adjust Quotas
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                {editAction === 'extend' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Additional Days to Add
                    </label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[7, 14, 30].map(d => (
                        <button
                          type="button"
                          key={d}
                          onClick={() => setExtendDays(d)}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                            extendDays === d
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          +{d} Days
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Extending will immediately activate the trial if it was expired.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Max Teachers Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={editMaxTeachers}
                        onChange={e => setEditMaxTeachers(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Max Students Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="2000"
                        value={editMaxStudents}
                        onChange={e => setEditMaxStudents(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingTrial(null)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
