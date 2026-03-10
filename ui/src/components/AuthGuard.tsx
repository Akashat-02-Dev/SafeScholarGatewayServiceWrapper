import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../services/authService'

export function AuthGuard() {
  const { status } = useAuth()
  const loc = useLocation()

  if (status === 'loading') {
    return (
      <div style={{ padding: 16, maxWidth: 920, margin: '24px auto' }}>
        <div>Loading…</div>
      </div>
    )
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return <Outlet />
}
