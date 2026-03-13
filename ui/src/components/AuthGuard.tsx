import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'

export function AuthGuard() {
  const { status } = useAuth()
  const loc = useLocation()

  if (status === 'loading') {
    return (
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ maxWidth: 520, margin: '34px auto' }}
        >
          <div className="card">
            <div className="cardInner" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="brandMark" style={{ width: 44, height: 44 }}>
                <Shield size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 720, letterSpacing: '-0.01em' }}>Loading</div>
                <div className="pageSub">Fetching your session…</div>
              </div>
              <div className="grow" />
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: '3px solid rgba(0, 45, 91, 0.12)',
                  borderTopColor: 'rgba(0, 45, 91, 0.9)',
                  animation: 'spin 900ms linear infinite',
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    )
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return <Outlet />
}
