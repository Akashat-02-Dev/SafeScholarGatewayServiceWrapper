import React, { useState, useEffect } from 'react'
import { apiFetch } from '../../services/apiClient'
import { useAuth } from '../../services/authService'
import { Sparkles, Plus, Copy, Check, Info, Library, ShieldAlert } from 'lucide-react'

interface CustomBot {
  bot_id: string
  institution_id: string
  teacher_id: string
  name: string
  system_prompt: string
  source_document_ids: string[]
  allowed_topics: string[]
  strictness_level: number
  created_at: string
}

interface DocumentInfo {
  document_name: string
  chunk_count: number
}

export default function CustomBotStudio() {
  const { me } = useAuth()
  const institutionId = me?.institutionId || ''
  const teacherId = me?.userId || ''

  // Form states
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [topics, setTopics] = useState('')
  const [strictness, setStrictness] = useState(5)
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])

  // Data states
  const [docsList, setDocsList] = useState<DocumentInfo[]>([])
  const [botsList, setBotsList] = useState<CustomBot[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Status states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const getTokens = () => {
    const raw = sessionStorage.getItem('safescholar.tokens.v1')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const loadData = async () => {
    if (!institutionId) return
    const tokens = getTokens()
    const token = tokens ? tokens.accessToken : null
    
    // 1. Fetch available district standard documents independently
    try {
      const docs = await apiFetch<DocumentInfo[]>(`/api/v1/rag/documents?institution_id=${institutionId}`, {
        accessToken: token
      })
      setDocsList(docs || [])
    } catch (err: any) {
      console.error('Failed to fetch district documents', err)
      setDocsList([])
      setError('Unable to fetch district documents from the orchestrator service.')
    }

    // 2. Fetch active custom Socratic bots independently
    try {
      const bots = await apiFetch<CustomBot[]>(`/api/v1/bots/list?institution_id=${institutionId}`, {
        accessToken: token
      })
      setBotsList(bots || [])
    } catch (err: any) {
      console.error('Failed to load custom Socratic Socratic bots', err)
      setBotsList([])
    }
  }

  useEffect(() => {
    loadData()
  }, [institutionId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !systemPrompt.trim()) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const parsedTopics = topics
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const payload = {
      institution_id: institutionId,
      teacher_id: teacherId,
      name,
      system_prompt: systemPrompt,
      source_document_ids: selectedDocs,
      allowed_topics: parsedTopics,
      strictness_level: strictness,
    }

    try {
      const tokens = getTokens()
      const token = tokens ? tokens.accessToken : null
      await apiFetch('/api/v1/bots/create', {
        method: 'POST',
        body: payload,
        accessToken: token
      })

      setSuccess('Bot configuration saved successfully!')
      setName('')
      setSystemPrompt('')
      setTopics('')
      setSelectedDocs([])
      setStrictness(5)
      loadData()
    } catch (err: any) {
      setError(err.message || 'Server failed to save chatbot configuration.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCode = (botId: string) => {
    navigator.clipboard.writeText(botId)
    setCopiedId(botId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggleDocSelection = (docName: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docName) ? prev.filter((d) => d !== docName) : [...prev, docName]
    )
  }

  return (
    <div className="page w-full" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title */}
      <div>
        <h1 className="pageTitle" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles className="icon-gold" style={{ color: 'var(--c-gold)' }} />
          Custom Socratic Bot Studio
        </h1>
        <p className="pageSub" style={{ marginTop: '6px' }}>
          Design specialized, multi-tenant Socratic tutor personas aligned directly to district educational materials.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="toast toastError" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="toast" style={{ width: '100%', borderLeft: '4px solid #22c55e', background: 'rgba(34, 197, 94, 0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22c55e' }}>
            <Check size={18} />
            <span>{success}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Creation panel */}
        <div className="card" style={{ background: 'var(--card)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)' }}>
          <div className="cardInner" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} style={{ color: 'var(--c-navy)' }} />
              Create Socratic Chatbot Config
            </h2>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="pageSub" style={{ fontWeight: '500', marginBottom: '6px', display: 'block' }}>Bot Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Algebra 1 Helper, AP Biology Coach"
                  className="input"
                  required
                  style={{ width: '100%', borderRadius: '10px' }}
                />
              </div>

              <div>
                <label className="pageSub" style={{ fontWeight: '500', marginBottom: '6px', display: 'block' }}>System Prompt & Socratic Personas</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Define your tutor's personality and instructions. e.g., 'You are a supportive AP Bio assistant. Guide the user step-by-step through cellular respiration...'"
                  className="input"
                  required
                  rows={4}
                  style={{ width: '100%', borderRadius: '10px', resize: 'vertical', minHeight: '100px' }}
                />
              </div>

              <div>
                <label className="pageSub" style={{ fontWeight: '500', marginBottom: '6px', display: 'block' }}>
                  Allowed Topics (comma separated)
                </label>
                <input
                  type="text"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g., photosynthesis, respiration, krebs cycle"
                  className="input"
                  style={{ width: '100%', borderRadius: '10px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="pageSub" style={{ fontWeight: '500', margin: 0 }}>Socratic Strictness level</label>
                  <span style={{ fontSize: '12px', background: 'rgba(0, 45, 91, 0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--c-navy)', fontWeight: 'bold' }}>
                    Level {strictness}/10
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={strictness}
                  onChange={(e) => setStrictness(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--c-navy)' }}
                />
              </div>

              <div>
                <label className="pageSub" style={{ fontWeight: '500', marginBottom: '6px', display: 'block' }}>
                  Attach District Knowledge Files (RAG)
                </label>
                <div style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '8px',
                  background: 'rgba(255,255,255,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {docsList.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '8px 0', textAlign: 'center' }}>
                      No documents available. Upload them via RAG Ingestion panel first.
                    </p>
                  ) : (
                    docsList.map((doc) => (
                      <div
                        key={doc.document_name}
                        onClick={() => toggleDocSelection(doc.document_name)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: selectedDocs.includes(doc.document_name) ? 'rgba(0, 45, 91, 0.08)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc.document_name)}
                          onChange={() => {}} // toggled on row click
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                          {doc.document_name}{' '}
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            ({doc.chunk_count} chunks)
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btnPrimary"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '600' }}
              >
                {isLoading ? 'Saving bot config...' : 'Save & Publish Bot Config'}
              </button>
            </form>
          </div>
        </div>

        {/* Existing bots list */}
        <div className="card" style={{ background: 'var(--card)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div className="cardInner" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Library size={18} style={{ color: 'var(--c-navy)' }} />
              Active Socratic Personas
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, maxHeight: '520px' }}>
              {botsList.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '40px', color: 'var(--muted)' }}>
                  <Info size={32} />
                  <p style={{ fontSize: '14px' }}>No active custom Socratic Socratic bots found for your district.</p>
                </div>
              ) : (
                botsList.map((bot) => (
                  <div
                    key={bot.bot_id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.65)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--c-navy)' }}>{bot.name}</h3>
                      <span style={{ fontSize: '11px', background: 'rgba(255, 193, 7, 0.18)', color: '#b27a00', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        Strictness: {bot.strictness_level}
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {bot.system_prompt}
                    </p>

                    {bot.allowed_topics && bot.allowed_topics.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {bot.allowed_topics.map((tag) => (
                          <span key={tag} style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(0, 45, 91, 0.05)', borderRadius: '6px', color: 'var(--c-slate)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(0, 45, 91, 0.05)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Socratic Room Code</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text)' }}>
                          {bot.bot_id.slice(0, 8)}...
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyCode(bot.bot_id)}
                        className="btn btnGhost iconBtn"
                        style={{
                          height: '32px',
                          width: '80px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          borderRadius: '8px',
                          padding: '0 8px'
                        }}
                      >
                        {copiedId === bot.bot_id ? (
                          <>
                            <Check size={12} style={{ color: '#22c55e' }} />
                            <span style={{ color: '#22c55e' }}>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
