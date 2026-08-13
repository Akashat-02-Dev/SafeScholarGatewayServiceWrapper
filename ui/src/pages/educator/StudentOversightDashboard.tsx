import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../../services/apiClient'
import { useAuth } from '../../services/authService'
import { Activity, Shield, Smile, Meh, Frown, Snowflake, Flame, RefreshCw, AlertTriangle } from 'lucide-react'

interface StudentEvent {
  session_id: string
  institution_id: string
  student_id: string
  prompt: string
  response: string
  timestamp: string
  sentiment: 'positive' | 'neutral' | 'frustrated'
  is_flagged: boolean
}

interface ActiveSession {
  session_id: string
  student_id: string
  warning_count: number
  sentiment: 'positive' | 'neutral' | 'frustrated'
  is_frozen: boolean
  last_prompt: string
  last_response: string
  last_active: Date
  messages: Array<{ sender: 'student' | 'ai'; text: string; timestamp: Date; isFlagged: boolean }>
}

export default function StudentOversightDashboard() {
  const { me } = useAuth()
  const institutionId = me?.institutionId || ''
  
  const [sessions, setSessions] = useState<Record<string, ActiveSession>>({})
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [connStatus, setConnStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<any>(null)

  const getTokens = () => {
    const raw = sessionStorage.getItem('safescholar.tokens.v1')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const connectWebSocket = () => {
    if (!institutionId) return
    
    // Singleton check: avoid duplicating connections if one is already connecting/connected
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return
    }
    
    setConnStatus('connecting')
    if (reconnectAttemptsRef.current === 0) {
      setError(null)
    }

    const tokens = getTokens()
    const token = tokens ? tokens.accessToken : ''

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/v1/admin/oversight/stream?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnStatus('connected')
      reconnectAttemptsRef.current = 0
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const payload: StudentEvent = JSON.parse(event.data)
        
        setSessions((prev) => {
          const current = prev[payload.session_id] || {
            session_id: payload.session_id,
            student_id: payload.student_id,
            warning_count: 0,
            sentiment: 'neutral',
            is_frozen: false,
            last_prompt: '',
            last_response: '',
            last_active: new Date(),
            messages: []
          }

          const newMessages = [...current.messages]
          newMessages.push({
            sender: 'student',
            text: payload.prompt,
            timestamp: new Date(payload.timestamp),
            isFlagged: payload.is_flagged
          })
          newMessages.push({
            sender: 'ai',
            text: payload.response,
            timestamp: new Date(payload.timestamp),
            isFlagged: false
          })

          return {
            ...prev,
            [payload.session_id]: {
              ...current,
              warning_count: current.warning_count + (payload.is_flagged ? 1 : 0),
              sentiment: payload.sentiment,
              last_prompt: payload.prompt,
              last_response: payload.response,
              last_active: new Date(payload.timestamp),
              messages: newMessages
            }
          }
        })
      } catch (err) {
        console.error('Failed to parse oversight event', err)
      }
    }

    ws.onclose = () => {
      setConnStatus('disconnected')

      // Do not spam console. Limit and retry with backoff.
      if (reconnectAttemptsRef.current < 5) {
        const delay = Math.min(16000, Math.pow(2, reconnectAttemptsRef.current) * 1000 + Math.random() * 500)
        reconnectAttemptsRef.current++
        
        setError(`Reconnecting to Oversight Mesh... (Attempt ${reconnectAttemptsRef.current}/5 in ${Math.round(delay / 1000)}s)`)
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, delay)
      } else {
        setError('Oversight telemetry stream interrupted. Max reconnection attempts reached.')
      }
    }

    ws.onerror = () => {
      setConnStatus('disconnected')
    }
  }

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        const ws = wsRef.current
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try {
              ws.close(1000, 'Component unmounted')
            } catch {}
          }
          ws.onerror = () => {
            try {
              ws.close()
            } catch {}
          }
          ws.onmessage = null
          ws.onclose = null
        } else {
          try {
            ws.close(1000, 'Component unmounted')
          } catch {}
        }
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [institutionId])

  const handleFreezeToggle = async (sessionId: string, currentFrozenState: boolean) => {
    const tokens = getTokens()
    const token = tokens ? tokens.accessToken : null
    
    try {
      await apiFetch('/api/v1/admin/oversight/freeze', {
        method: 'POST',
        body: {
          session_id: sessionId,
          freeze: !currentFrozenState
        },
        accessToken: token
      })

      // Update local state immediately
      setSessions((prev) => {
        if (!prev[sessionId]) return prev
        return {
          ...prev,
          [sessionId]: {
            ...prev[sessionId],
            is_frozen: !currentFrozenState
          }
        }
      })
    } catch (err: any) {
      console.error('Failed to toggle freeze state', err)
      alert('Failed to update student session freeze status.')
    }
  }

  const renderSentimentIcon = (sentiment: 'positive' | 'neutral' | 'frustrated') => {
    switch (sentiment) {
      case 'positive':
        return <Smile size={16} style={{ color: '#22c55e' }} />
      case 'neutral':
        return <Meh size={16} style={{ color: 'var(--c-slate)' }} />
      case 'frustrated':
        return <Frown size={16} style={{ color: '#ef4444' }} />
    }
  }

  const activeSessions = Object.values(sessions).sort(
    (a, b) => b.last_active.getTime() - a.last_active.getTime()
  )

  const selectedSession = selectedSessionId ? sessions[selectedSessionId] : null

  return (
    <div className="page" style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: '16px' }}>
      {/* Dashboard Topbar */}
      <div className="card" style={{ background: 'var(--card)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)' }}>
        <div className="cardInner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div>
            <h1 className="pageTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
              <Activity style={{ color: 'var(--c-navy)' }} size={20} />
              Student Activity Oversight Dashboard
            </h1>
            <p className="pageSub" style={{ marginTop: '2px', fontSize: '12px' }}>
              Real-time student safety triggers, Socratic chat logs, and intervention locks.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: connStatus === 'connected' ? '#22c55e' : connStatus === 'connecting' ? '#ffc107' : '#ef4444'
              }} />
              <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{connStatus}</span>
            </div>

            {connStatus === 'disconnected' && (
              <button onClick={connectWebSocket} className="btn btnGhost iconBtn" style={{ height: '32px', width: '32px' }}>
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="toast toastError" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Grid split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Side: Sessions List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="cardInner" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--c-slate)', letterSpacing: '0.5px' }}>
              Active Chat Streams ({activeSessions.length})
            </h3>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeSessions.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '60px', color: 'var(--muted)' }}>
                  <Smile size={32} />
                  <p style={{ fontSize: '13px', textAlign: 'center' }}>No active student sandbox sessions detected. Waiting for student connections...</p>
                </div>
              ) : (
                activeSessions.map((session) => (
                  <div
                    key={session.session_id}
                    onClick={() => setSelectedSessionId(session.session_id)}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '12px',
                      background: selectedSessionId === session.session_id ? 'rgba(0, 45, 91, 0.05)' : 'rgba(255, 255, 255, 0.55)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--c-navy)' }}>
                        Session: {session.session_id.slice(-8)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {renderSentimentIcon(session.sentiment)}
                        {session.warning_count > 0 && (
                          <span style={{
                            fontSize: '10px',
                            background: '#ef4444',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <AlertTriangle size={10} />
                            {session.warning_count}
                          </span>
                        )}
                        {session.is_frozen && (
                          <span style={{ fontSize: '10px', background: 'rgba(0, 45, 91, 0.1)', color: 'var(--c-navy)', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                            FROZEN
                          </span>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>Std:</strong> {session.last_prompt || '(Connected, typing...)'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>AI:</strong> {session.last_response || 'Waiting for first message...'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Log & Freeze controls */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="cardInner" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
            {selectedSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
                {/* Header Action controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'var(--c-navy)' }}>
                      Detailed Chat Log: {selectedSession.session_id.slice(-12)}
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Student ID: {selectedSession.student_id}
                    </span>
                  </div>

                  <button
                    onClick={() => handleFreezeToggle(selectedSession.session_id, selectedSession.is_frozen)}
                    className="btn"
                    style={{
                      backgroundColor: selectedSession.is_frozen ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      border: 'none',
                      color: selectedSession.is_frozen ? '#22c55e' : '#ef4444',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {selectedSession.is_frozen ? (
                      <>
                        <Flame size={14} />
                        Unfreeze AI Session
                      </>
                    ) : (
                      <>
                        <Snowflake size={14} />
                        Freeze AI Session
                      </>
                    )}
                  </button>
                </div>

                {/* Conversation feed */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                  {selectedSession.messages.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: msg.sender === 'student' ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        maxWidth: '75%',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        background: msg.sender === 'student' ? 'var(--c-navy)' : 'rgba(255, 255, 255, 0.9)',
                        color: msg.sender === 'student' ? 'var(--c-white)' : 'var(--text)',
                        border: msg.isFlagged ? '2px solid #ef4444' : '1px solid var(--border)',
                        borderBottomRightRadius: msg.sender === 'student' ? '2px' : '12px',
                        borderBottomLeftRadius: msg.sender === 'student' ? '12px' : '2px',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        {msg.isFlagged && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>
                            <AlertTriangle size={12} />
                            SAFETY FLAGGED (BLOCK MESSAGE)
                          </div>
                        )}
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '100px', color: 'var(--muted)', flex: 1 }}>
                <Shield size={40} />
                <p style={{ fontSize: '14px', fontWeight: '500' }}>Select a student session from the left stream to oversee dialogs.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
