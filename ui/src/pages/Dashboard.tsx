import { useAuth } from '../services/authService'
import { motion } from 'framer-motion'
import { Building2, KeyRound, Shield } from 'lucide-react'

export function Dashboard() {
  const { me } = useAuth()
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="page">
      <div className="card">
        <div className="cardInner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 className="pageTitle">Dashboard</h2>
              <div className="pageSub">Overview of your access and quick actions.</div>
            </div>
          </div>

          <div className="divider" />

          <div className="kpiRow">
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <KeyRound size={16} /> Signed in as
              </div>
              <div className="kpiValue">{me?.email || '—'}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Building2 size={16} /> Institution
              </div>
              <div className="kpiValue kpiValueMono mono">{me?.institutionId || '—'}</div>
            </div>
          </div>

          <div className="divider" />

          <div className="grid2">
            <div className="toast">
              <div style={{ fontSize: 12, opacity: 0.75 }}>Roles</div>
              <div className="wrap" style={{ marginTop: 10 }}>
                {(me?.roles || []).length ? (me?.roles || []).map((r) => <span key={r} className="chip">{r}</span>) : <span className="muted">—</span>}
              </div>
            </div>
            <div className="toast">
              <div style={{ fontSize: 12, opacity: 0.75 }}>Permissions</div>
              <div className="wrap" style={{ marginTop: 10 }}>
                {(me?.permissions || []).length ? (me?.permissions || []).map((p) => <span key={p} className="chip">{p}</span>) : <span className="muted">—</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
