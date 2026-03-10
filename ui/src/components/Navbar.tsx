import { Link } from 'react-router-dom'
import { useAuth } from '../services/authService'

export function Navbar() {
  const { status, me, logout, hasPermission } = useAuth()

  return (
    <div style={{ padding: 12, borderBottom: '1px solid #e5e5e5', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link to="/dashboard" style={{ fontWeight: 700 }}>
          SafeScholar
        </Link>
        <div style={{ flex: 1 }} />
        {status === 'authenticated' ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{me?.email}</div>
            {hasPermission('MANAGE_ROLES') ? <Link to="/role-management">Roles</Link> : null}
            {hasPermission('MANAGE_USERS') ? <Link to="/user-management">Users</Link> : null}
            {hasPermission('MODERATE_CONTENT') ? <Link to="/moderation">Moderation</Link> : null}
            <button onClick={() => void logout()}>Logout</button>
          </div>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </div>
  )
}
