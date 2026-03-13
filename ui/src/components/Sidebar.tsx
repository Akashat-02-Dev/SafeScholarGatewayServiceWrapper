import { NavLink } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { LayoutGrid, ShieldCheck, Users, Wrench } from 'lucide-react'

export function Sidebar() {
  const { hasPermission } = useAuth()

  return (
    <div className="card">
      <div className="sideNav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
        >
          <LayoutGrid size={18} />
          Dashboard
        </NavLink>
        {hasPermission('MANAGE_USERS') ? (
          <NavLink
            to="/user-management"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Users size={18} />
            User Management
          </NavLink>
        ) : null}
        {hasPermission('MANAGE_ROLES') ? (
          <NavLink
            to="/role-management"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <Wrench size={18} />
            Role Management
          </NavLink>
        ) : null}
        {hasPermission('MODERATE_CONTENT') ? (
          <NavLink
            to="/moderation"
            className={({ isActive }) => `navItem ${isActive ? 'navItemActive' : ''}`}
          >
            <ShieldCheck size={18} />
            Moderation Panel
          </NavLink>
        ) : null}
      </div>
    </div>
  )
}
