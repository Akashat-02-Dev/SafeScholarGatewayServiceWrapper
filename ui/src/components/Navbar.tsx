import { Link } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { motion } from 'framer-motion'
import { LogOut, UserRound } from 'lucide-react'

export function Navbar() {
  const { status, me, logout } = useAuth()

  return (
    <div className="topbar">
      <div className="container">
        <div className="topbarInner">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
            <Link to="/dashboard" className="brand">
              <span className="brandMark">
                <img className="brandLogo" src="/main-logo.png" alt="SafeScholar" />
              </span>
              SafeScholar
            </Link>
          </motion.div>

          <div className="grow" />

          {status === 'authenticated' ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <div className="chip">
                <UserRound size={16} color="rgba(0, 45, 91, 0.8)" />
                <div style={{ fontSize: 12, fontWeight: 650, color: 'rgba(0, 45, 91, 0.88)' }}>{me?.email}</div>
              </div>

              <button className="btn btnPrimary iconBtn" onClick={() => void logout()} aria-label="Logout">
                <LogOut size={18} />
              </button>
            </motion.div>
          ) : (
            <Link to="/login" className="btn btnPrimary">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
