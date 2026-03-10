import { useAuth } from '../services/authService'
import { Link } from 'react-router-dom'

export function Dashboard() {
  const { me, hasPermission } = useAuth()
  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {hasPermission('MANAGE_USERS') ? <Link to="/user-management">User Management</Link> : null}
        {hasPermission('MANAGE_ROLES') ? <Link to="/role-management">Role Management</Link> : null}
        {hasPermission('MODERATE_CONTENT') ? <Link to="/moderation">Moderation Panel</Link> : null}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Signed in as</div>
        <div style={{ fontWeight: 700 }}>{me?.email || '—'}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>Institution</div>
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}>
          {me?.institutionId || '—'}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Roles</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {(me?.roles || []).length ? (me?.roles || []).map((r) => <span key={r}>{r}</span>) : <span>—</span>}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Permissions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {(me?.permissions || []).length ? (me?.permissions || []).map((p) => <span key={p}>{p}</span>) : <span>—</span>}
        </div>
      </div>
    </div>
  )
}
