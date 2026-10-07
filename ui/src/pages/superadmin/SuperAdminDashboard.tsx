import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, Building2, Activity, CheckCircle2, 
  Cpu, HardDrive, AlertCircle, RefreshCw,
  Clock, Plus, Play, Pause, Sliders, Trash2,
  Users, GraduationCap, X, Calendar, Sparkles
} from 'lucide-react'
import { useAuth } from '../../services/authService'
import { apiFetch } from '../../services/apiClient'

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

export function SuperAdminDashboard() {
  const { tokens } = useAuth()
  const accessToken = tokens?.accessToken || ''

  // Data states
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

  // UI status
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Modals
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
    try {
      const [metricsRes, trialsRes] = await Promise.allSettled([
        apiFetch<{ telemetry?: TelemetryRow[] }>('/api/v1/dashboard/metrics', {
          method: 'GET',
          accessToken
        }),
        apiFetch<{ trials?: TrialInstitute[] }>('/api/v1/admin/trials', {
          method: 'GET',
          accessToken
        })
      ])

      if (metricsRes.status === 'fulfilled') {
        setTelemetry(metricsRes.value.telemetry || [])
      }
      if (trialsRes.status === 'fulfilled') {
        setTrials(trialsRes.value.trials || [])
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load console data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [accessToken])

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
      // Reset form
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

  const trialList = trials.filter(t => t.isTrial)
  const activeTrialCount = trialList.filter(t => t.trialStatus === 'active').length

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card shadow-lg border border-slate-200/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden">
        <div className="cardInner p-4 sm:p-6 md:p-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-800 to-purple-900 text-white shadow-lg shrink-0">
                <Shield size={24} className="sm:w-7 sm:h-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                  Global Infrastructure & Trial Console
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Super Admin Only
                  </span>
                </h2>
                <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Multi-tenant governance, trial onboarding (7-30 days), teacher/student quota enforcement, and volumetric monitoring.
                </div>
              </div>
            </div>

            <button
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm self-end sm:self-center"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {err ? <div className="toast toastError mb-4">{err}</div> : null}
          {ok ? <div className="toast toastOk mb-4 flex items-center gap-2"><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-5 shadow-sm">
              <div className="text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 mb-2">
                <Cpu size={18} className="text-indigo-500" /> Total Active Tenants
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{telemetry.length}</div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200/60 dark:border-indigo-800/60 p-5 shadow-sm">
              <div className="text-indigo-700 dark:text-indigo-300 font-semibold text-xs sm:text-sm flex items-center gap-2 mb-2">
                <Clock size={18} className="text-indigo-600 dark:text-indigo-400" /> Active Trials (7-30d)
              </div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-900 dark:text-indigo-100">
                {activeTrialCount} <span className="text-xs font-medium text-slate-500">/ {trialList.length} total</span>
              </div>
            </div>
            
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-5 shadow-sm">
              <div className="text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 mb-2">
                <HardDrive size={18} className="text-blue-500" /> Volumetric Request Rate
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
                {telemetry.reduce((sum, t) => sum + t.totalRequests, 0)} <span className="text-xs font-medium text-slate-500">reqs/hr</span>
              </div>
            </div>
            
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-5 shadow-sm">
              <div className="text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 mb-2">
                <Activity size={18} className="text-emerald-500" /> Total Token Load
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
                {telemetry.reduce((sum, t) => sum + t.promptTokens + t.completionTokens, 0).toLocaleString()} <span className="text-xs font-medium text-slate-500">tokens</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 1: Trial Onboarding & Governance (Super Admin)    */}
          {/* ======================================================== */}
          <div className="mb-10 p-5 sm:p-7 rounded-3xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/80 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <Sparkles size={20} className="text-amber-500" />
                  Trial Onboarding & Institutional Governance
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Onboard pilot institutions with time-bounded access (7 to 30 days) and enforce strict quotas on onboarded teachers and students.
                </p>
              </div>

              <button
                onClick={() => setShowOnboardModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
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
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100/70 dark:bg-zinc-800/80">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Institute & Domain</th>
                      <th className="px-5 py-3.5 font-semibold text-center">Trial Status</th>
                      <th className="px-5 py-3.5 font-semibold text-center">Remaining</th>
                      <th className="px-5 py-3.5 font-semibold text-center">Teacher Quota</th>
                      <th className="px-5 py-3.5 font-semibold text-center">Student Quota</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
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
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{inst.name}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{inst.domain}</div>
                          </td>
                          <td className="px-5 py-4 text-center">
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
                          <td className="px-5 py-4 text-center font-medium">
                            {isExpired ? (
                              <span className="text-xs text-rose-500 font-semibold">Ended</span>
                            ) : isPaused ? (
                              <span className="text-xs text-amber-500 font-semibold">Suspended</span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
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
                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center gap-1 min-w-[110px]">
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
                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center gap-1 min-w-[110px]">
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
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {isActive ? (
                                <button
                                  onClick={() => void handleToggleTrial(inst, 'pause')}
                                  title="Pause Trial Access"
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 transition-colors"
                                >
                                  <Pause size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => void handleToggleTrial(inst, 'resume')}
                                  title="Resume Trial Access"
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 transition-colors"
                                >
                                  <Play size={14} />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setEditingTrial(inst)
                                  setEditAction('extend')
                                  setExtendDays(7)
                                }}
                                title="Extend Duration"
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 transition-colors"
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
                                <Sliders size={14} />
                              </button>

                              <button
                                onClick={() => void handleToggleTrial(inst, 'delete')}
                                title="Revoke & Delete Trial"
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 transition-colors"
                              >
                                <Trash2 size={14} />
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

          {/* Tenant Activation Onboarding Queue */}
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
                <table className="w-full text-sm text-left whitespace-nowrap">
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
                <table className="w-full text-sm text-left whitespace-nowrap">
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

        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: Onboard Trial Institute (Super Admin Only)       */}
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
      {/* MODAL 2: Extend Trial or Adjust Quotas                    */}
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
