import { useState } from 'react'
import { motion } from 'framer-motion'
import { Scissors, Sparkles, CheckCircle2, FileText } from 'lucide-react'
import { useAuth } from '../../services/authService'
import { aiService } from '../../services/aiService'

export default function TextLeveler() {
  const { me } = useAuth()
  const institutionId = me?.institutionId || 'default'

  // Input states
  const [inputText, setInputText] = useState('')
  const [targetGrade, setTargetGrade] = useState(5) // default to Grade 5
  
  // UI states
  const [isLoading, setIsLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  
  // Results
  const [leveledText, setLeveledText] = useState('')
  const [showHighlights, setShowHighlights] = useState(false)

  const maxChars = 50000

  async function handleLevelText(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim()) return
    setIsLoading(true)
    setErr(null)
    setOk(null)
    setLeveledText('')

    try {
      const payload = {
        tool_id: 'leveler' as const,
        institution_id: institutionId,
        parameters: {
          user_prompt: inputText,
          target_grade: `Grade ${targetGrade}`
        }
      }
      
      const res = await aiService.executeTool<{ user_prompt: string; target_grade: string }, string>(
        'leveler',
        payload
      )
      setLeveledText(res.response_text)
      setOk('Instructional text successfully adjusted to the target comprehension tier.')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'failed to level text')
    } finally {
      setIsLoading(false)
    }
  }

  // Highlights words in the leveled text that were NOT present in the original input text
  function renderLeveledText() {
    if (!leveledText) return null
    if (!showHighlights) return leveledText

    const originalWords = new Set(inputText.toLowerCase().match(/\b\w+\b/g) || [])
    const tokens = leveledText.split(/(\b)/) // split by word boundaries to preserve spacing/punctuation

    return tokens.map((token, idx) => {
      const cleanToken = token.toLowerCase().replace(/[^\w]/g, '')
      const isWord = /^\w+$/.test(cleanToken)
      
      // If it is a word and it didn't exist in the original text, highlight it
      if (isWord && cleanToken && !originalWords.has(cleanToken) && originalWords.size > 0) {
        return (
          <span
            key={idx}
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              padding: '1px 3px',
              borderRadius: '3px',
              fontWeight: '600'
            }}
          >
            {token}
          </span>
        )
      }
      return token
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card">
        <div className="cardInner">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <Scissors size={20} />
            </div>
            <div>
              <h2 className="pageTitle">Text Leveler</h2>
              <div className="pageSub">Adapt complex learning materials to specific grade level Lexile targets.</div>
            </div>
          </div>

          {err ? <div className="toast toastError" style={{ marginTop: 12 }}>{err}</div> : null}
          {ok ? <div className="toast toastOk" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Form */}
          <form onSubmit={handleLevelText} style={{ marginTop: 20 }}>
            <div className="grid2" style={{ alignItems: 'stretch' }}>
              
              {/* Left Card: Input Text & Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="label">Original Complex Text</div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {inputText.length} / {maxChars} characters
                    </span>
                  </div>
                  <textarea
                    className="textarea"
                    placeholder="Paste your complex instructional text or article here (up to 50,000 characters)..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value.slice(0, maxChars))}
                    style={{ flex: 1, minHeight: '260px', fontFamily: 'inherit', resize: 'vertical' }}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="field" style={{ background: 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="label" style={{ margin: 0 }}>Target Grade level: <strong>Grade {targetGrade}</strong></div>
                    <span className="chip" style={{ fontSize: 9 }}>
                      {targetGrade <= 5 ? 'Elementary' : targetGrade <= 8 ? 'Middle School' : 'High School'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={targetGrade}
                    onChange={(e) => setTargetGrade(Number(e.target.value))}
                    disabled={isLoading}
                    style={{ width: '100%', marginTop: 8, accentColor: 'var(--c-navy)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                    <span>Grade 1</span>
                    <span>Grade 6</span>
                    <span>Grade 12</span>
                  </div>
                </div>

                <button type="submit" className="btn btnPrimary" disabled={isLoading || !inputText.trim()}>
                  <Sparkles size={16} />
                  {isLoading ? 'Adapting Text...' : 'Adapt Text Level'}
                </button>
              </div>

              {/* Right Card: Output Text & Comparison */}
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                    <FileText size={16} />
                    Leveled Output
                  </div>
                  {leveledText && (
                    <button
                      type="button"
                      className="btn btnGhost"
                      onClick={() => setShowHighlights(!showHighlights)}
                      style={{ fontSize: 11, padding: '4px 10px', height: 'auto', background: showHighlights ? 'rgba(245, 158, 11, 0.08)' : 'none', border: showHighlights ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)' }}
                    >
                      {showHighlights ? 'Hide Word Changes' : 'Highlight Vocabulary Changes'}
                    </button>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: '340px',
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'rgba(255, 255, 255, 0.4)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {leveledText ? (
                    renderLeveledText()
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', textAlign: 'center' }}>
                      <FileText size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
                      <span>Adjusted Text Preview</span>
                      <p style={{ fontSize: 11, margin: '4px 0 0 0', maxWidth: 200 }}>
                        Your simplified, age-appropriate text will generate in this window.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </form>

        </div>
      </div>
    </motion.div>
  )
}
