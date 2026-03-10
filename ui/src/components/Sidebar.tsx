import { NavLink } from 'react-router-dom'
import { useAuth } from '../services/authService'

export function Sidebar() {
  const { hasPermission } = useAuth()

  return (
    <div style={{ padding: 12, borderRight: '1px solid #e5e5e5', minWidth: 220 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NavLink to="/dashboard">Dashboard</NavLink>
        {hasPermission('MANAGE_USERS') ? <NavLink to="/user-management">User Management</NavLink> : null}
        {hasPermission('MANAGE_ROLES') ? <NavLink to="/role-management">Role Management</NavLink> : null}
        {hasPermission('MODERATE_CONTENT') ? <NavLink to="/moderation">Moderation Panel</NavLink> : null}
      </div>
    </div>
  )
}
