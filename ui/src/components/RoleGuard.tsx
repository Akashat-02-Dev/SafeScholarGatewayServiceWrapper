import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../services/authService'

export function RoleGuard({
  requiredRoles,
  requiredPermissions,
  fallbackTo = '/dashboard',
}: {
  requiredRoles?: string[]
  requiredPermissions?: string[]
  fallbackTo?: string
}) {
  const { status, me, hasPermission } = useAuth()
  if (status === 'loading') return null
  if (status !== 'authenticated' || !me) return <Navigate to="/login" replace />

  const roles = (requiredRoles || []).map((r) => r.trim().toLowerCase()).filter(Boolean)
  const perms = (requiredPermissions || []).map((p) => p.trim().toUpperCase()).filter(Boolean)

  if (roles.length === 0 && perms.length === 0) return <Outlet />

  if (perms.length > 0 && hasPermission(...perms)) return <Outlet />
  if (roles.length > 0) {
    const set = new Set((me.roles || []).map((r) => r.trim().toLowerCase()).filter(Boolean))
    for (const r of roles) {
      if (!set.has(r)) return <Navigate to={fallbackTo} replace />
    }
    return <Outlet />
  }

  return <Navigate to={fallbackTo} replace />
}
