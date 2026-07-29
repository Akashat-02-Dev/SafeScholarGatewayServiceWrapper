import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ShieldAlert, Loader2, X } from 'lucide-react'
import { deleteUser, isolateUser } from '../../services/roleService'
import { ApiError } from '../../services/apiClient'

interface UserTarget {
  userId: string
  email: string
  firstName?: string
  lastName?: string
}

interface IsolateUserModalProps {
  isOpen: boolean
  user: UserTarget | null
  accessToken: string | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export const IsolateUserModal: React.FC<IsolateUserModalProps> = ({
  isOpen,
  user,
  accessToken,
  onClose,
  onSuccess,
}) => {
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen || !user) return null

  const targetEmail = user.email.trim().toLowerCase()
  const typedEmail = confirmEmail.trim().toLowerCase()
  const isMatch = targetEmail === typedEmail && targetEmail.length > 0

  const handleExecuteIsolate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isMatch || !accessToken || busy) return

    setBusy(true)
    setErrorMsg(null)

    try {
      // Calls the Go backend soft-isolation & session-revocation workflow
      await isolateUser(accessToken, user.userId)
      onSuccess(`Account for ${user.email} has been soft-isolated and sessions revoked successfully.`)
      setConfirmEmail('')
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Failed to isolate account.')
      } else if (err instanceof Error) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('An unexpected network error occurred while isolating account.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 1000 }}>
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/30 bg-white/85 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/50"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Close Icon */}
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
              borderRadius: '8px',
            }}
          >
            <X size={18} />
          </button>

          {/* Rose Icon Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              background: 'rgba(244, 63, 94, 0.12)',
              color: '#e11d48',
              marginBottom: '16px',
              border: '1px solid rgba(244, 63, 94, 0.2)',
            }}
          >
            <ShieldAlert size={26} />
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            Isolate User Account
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            This security action updates account status to <strong style={{ color: '#e11d48' }}>ISOLATED</strong> and immediately invalidates active sessions in Redis.
          </p>

          {errorMsg && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#dc2626',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleExecuteIsolate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Behavioral Safety Verification
              </label>
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '8px' }}>
                Type <strong style={{ userSelect: 'all', color: '#0f172a' }}>{user.email}</strong> below to confirm isolation:
              </div>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user.email}
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: isMatch ? '1px solid #e11d48' : '1px solid #cbd5e1',
                  background: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!isMatch || busy}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isMatch ? '#e11d48' : '#94a3b8',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isMatch && !busy ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isMatch ? '0 4px 12px rgba(225, 29, 72, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Isolating...</span>
                  </>
                ) : (
                  <span>Confirm Isolation</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
