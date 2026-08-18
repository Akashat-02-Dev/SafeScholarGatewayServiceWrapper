import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Shield, Building2, Activity, CheckCircle2, 
  Cpu, HardDrive, AlertCircle, RefreshCw 
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

export function SuperAdminDashboard() {
  const { tokens } = useAuth()
  const accessToken = tokens?.accessToken || ''

  // Data states
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([])
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
  const [, setIsLoading] = useState(true)


  async function loadTelemetry() {
    if (!accessToken) return
    setIsLoading(true)
    try {
      const res = await apiFetch<{ telemetry?: TelemetryRow[] }>('/api/v1/dashboard/metrics', {
        method: 'GET',
        accessToken
      })
      setTelemetry(res.telemetry || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed to load global telemetry metrics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTelemetry()
  }, [accessToken])

  async function handleAuthorize(ticket: OnboardingTicket) {
    setErr(null)
    setOk(null)
    try {
      // Simulate district database provisioning and seeding
      setOnboarding(prev => prev.filter(t => t.ticketId !== ticket.ticketId))
      setOk(`Tenant provisioned successfully. Domain ${ticket.requestedSubdomain} is now active. Seeding initial Institution Admin account...`)
      void loadTelemetry()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed to authorize tenant')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card shadow-lg border border-slate-200/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden">
        <div className="cardInner p-4 sm:p-6 md:p-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6 mb-6">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-900 text-white shadow-lg shrink-0">
              <Shield size={24} className="sm:w-7 sm:h-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Global Infrastructure Console</h2>
              <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Super Admin control plane for multi-tenant rate limits, load balancing, and usage metrics.</div>
            </div>
          </div>

          {err ? <div className="toast toastError mb-4">{err}</div> : null}
          {ok ? <div className="toast toastOk mb-4 flex items-center gap-2"><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-5 sm:p-6 shadow-sm">
              <div className="text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 mb-3">
                <Cpu size={18} className="text-indigo-500" /> Total Active Tenants
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{telemetry.length}</div>
            </div>
            
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-5 sm:p-6 shadow-sm">
              <div className="text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 mb-3">
                <HardDrive size={18} className="text-blue-500" /> Volumetric request rate
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
                {telemetry.reduce((sum, t) => sum + t.totalRequests, 0)} <span className="text-sm font-medium text-slate-500">reqs/hr</span>
              </div>
            </div>
            
            <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-5 sm:p-6 shadow-sm">
              <div className="text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-2 mb-3">
                <Activity size={18} className="text-emerald-500" /> Total Token Load
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
                {telemetry.reduce((sum, t) => sum + t.promptTokens + t.completionTokens, 0).toLocaleString()} <span className="text-sm font-medium text-slate-500">tokens</span>
              </div>
            </div>
          </div>

          {/* Tenant Activation Onboarding Queue */}
          <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-slate-200 dark:border-zinc-800">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500" /> Tenant Activation Queue
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
                            onClick={() => void handleAuthorize(ticket)}
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
              <button
                onClick={() => void loadTelemetry()}
                className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <RefreshCw size={14} /> Refresh Metrics
              </button>
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
    </motion.div>
  )
}
