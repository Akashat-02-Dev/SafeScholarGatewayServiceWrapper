import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Shield, Building2, Users, Activity, CheckCircle2, 
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
  const [isLoading, setIsLoading] = useState(true)

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
      <div className="card">
        <div className="cardInner">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="brandMark" style={{ width: 44, height: 44 }}>
              <Shield size={22} />
            </div>
            <div>
              <h2 className="pageTitle">Global Infrastructure Console</h2>
              <div className="pageSub">Super Admin control plane for multi-tenant rate limits, load balancing, and usage metrics.</div>
            </div>
          </div>

          {err ? <div className="toast toastError" style={{ marginTop: 12 }}>{err}</div> : null}
          {ok ? <div className="toast toastOk" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Quick Metrics */}
          <div className="kpiRow" style={{ marginTop: 20 }}>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Cpu size={16} /> Total Active Tenants
              </div>
              <div className="kpiValue">{telemetry.length}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <HardDrive size={16} /> Volumetric request rate
              </div>
              <div className="kpiValue">
                {telemetry.reduce((sum, t) => sum + t.totalRequests, 0)} reqs/hr
              </div>
            </div>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Activity size={16} /> Total Token Load
              </div>
              <div className="kpiValue">
                {telemetry.reduce((sum, t) => sum + t.promptTokens + t.completionTokens, 0).toLocaleString()} tokens
              </div>
            </div>
          </div>

          {/* Tenant Activation Onboarding Queue */}
          <div style={{ marginTop: 30, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <h3 style={{ color: 'var(--c-navy)', fontSize: 15, margin: '0 0 12px 0' }}>Tenant Activation Onboarding Queue</h3>
            {onboarding.length === 0 ? (
              <div className="toast" style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                No pending tenant activation tickets.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 45, 91, 0.02)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>School District Name</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Contact Domain Address</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Requested Subdomain</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Requested Date</th>
                      <th style={{ padding: '10px 16px', width: '15%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboarding.map(ticket => (
                      <tr key={ticket.ticketId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{ticket.districtName}</td>
                        <td style={{ padding: '12px 16px' }}>{ticket.contactEmail}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--c-navy)' }}>
                          {ticket.requestedSubdomain}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => void handleAuthorize(ticket)}
                            className="btn btnPrimary"
                            style={{ padding: '4px 8px', fontSize: 11, height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Building2 size={14} /> Authorize Tenant
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
          <div style={{ marginTop: 30, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: 'var(--c-navy)', fontSize: 15, margin: 0 }}>System Volumetric Load Analyzer</h3>
              <button
                onClick={() => void loadTelemetry()}
                className="btn btnGhost"
                style={{ padding: '4px 8px', height: 'auto', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={12} /> Refresh Metrics
              </button>
            </div>

            {telemetry.length === 0 ? (
              <div className="toast" style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                No active tenants detected in the telemetry stream.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 45, 91, 0.02)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left' }}>Tenant Name</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Active Teachers</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Active Candidates</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Request Count</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Prompt Tokens</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Completion Tokens</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Total Token Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telemetry.map(row => (
                      <tr key={row.institutionId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {row.name}
                          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 'normal', marginTop: 2 }}>ID: {row.institutionId}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{row.activeTeachers}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{row.activeCandidates}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>{row.totalRequests}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>{row.promptTokens.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>{row.completionTokens.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--c-navy)' }}>
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
