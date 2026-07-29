import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Sparkles, CheckCircle2, Table, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../services/authService'
import { aiService } from '../../services/aiService'

interface RubricCriterion {
  name: string
  novice: string
  developing: string
  proficient: string
  exemplary: string
}

export default function IepGenerator() {
  const { me } = useAuth()
  const institutionId = me?.institutionId || 'default'

  // Input states
  const [topic, setTopic] = useState('')
  const [rubricTitle, setRubricTitle] = useState('')
  const [criteria, setCriteria] = useState<RubricCriterion[]>([])

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setIsLoading(true)
    setErr(null)
    setOk(null)
    setCriteria([])

    try {
      const payload = {
        tool_id: 'iep_generator' as const,
        institution_id: institutionId,
        parameters: {
          user_prompt: topic
        }
      }
      
      const res = await aiService.executeTool<typeof payload.parameters, string>(
        'iep-generator',
        payload
      )
      
      const parsed = JSON.parse(res.response_text) as { title: string; criteria: RubricCriterion[] }
      setRubricTitle(parsed.title || 'Evaluative Rubric')
      setCriteria(parsed.criteria || [])
      setOk('Individualized Rubric Matrix successfully generated.')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'failed to generate rubric matrix')
    } finally {
      setIsLoading(false)
    }
  }

  function handleCellChange(rowIdx: number, field: keyof RubricCriterion, val: string) {
    setCriteria(prev => {
      const copy = [...prev]
      copy[rowIdx] = {
        ...copy[rowIdx],
        [field]: val
      }
      return copy
    })
  }

  function addRow() {
    setCriteria(prev => [
      ...prev,
      {
        name: 'New Criteria',
        novice: 'Description of novice performance level.',
        developing: 'Description of developing performance level.',
        proficient: 'Description of proficient performance level.',
        exemplary: 'Description of exemplary performance level.'
      }
    ])
  }

  function deleteRow(idx: number) {
    setCriteria(prev => prev.filter((_, rIdx) => rIdx !== idx))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card">
        <div className="cardInner">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <FileText size={20} />
            </div>
            <div>
              <h2 className="pageTitle">IEP & Rubric Matrix Generator</h2>
              <div className="pageSub">Compose individualized matrix rubrics and student-centric performance evaluation templates.</div>
            </div>
          </div>

          {err ? <div className="toast toastError" style={{ marginTop: 12 }}>{err}</div> : null}
          {ok ? <div className="toast toastOk" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Form */}
          <form onSubmit={handleGenerate} style={{ marginTop: 20 }}>
            <div className="field">
              <div className="label">Evaluation Objective / IEP Goal Description</div>
              <textarea
                className="textarea"
                placeholder="e.g. Write a persuasive essay on renewable energy, demonstrating logical progression, evidence gathering, and structured vocabulary usage..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                disabled={isLoading}
                style={{ minHeight: '100px' }}
              />
            </div>

            <button type="submit" className="btn btnPrimary" style={{ marginTop: 16 }} disabled={isLoading || !topic.trim()}>
              <Sparkles size={16} />
              {isLoading ? 'Composing Matrix...' : 'Compose Rubric Matrix'}
            </button>
          </form>

          {/* Rubric Matrix Editor Grid */}
          {criteria.length > 0 && (
            <div style={{ marginTop: 30, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--c-navy)', fontSize: 16 }}>{rubricTitle}</h3>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Double-click any cell text area to modify evaluation descriptions dynamically.</span>
                </div>
                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={addRow}
                  style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} />
                  Add Criteria Row
                </button>
              </div>

              {/* Rubric Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 45, 91, 0.03)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-navy)', width: '15%' }}>Criteria</th>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-navy)', width: '20%' }}>Novice (1)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-navy)', width: '20%' }}>Developing (2)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-navy)', width: '20%' }}>Proficient (3)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-navy)', width: '20%' }}>Exemplary (4)</th>
                      <th style={{ padding: '12px 16px', width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((c, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: rIdx < criteria.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        
                        {/* Name Cell */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top', background: 'rgba(0, 0, 0, 0.01)' }}>
                          <input
                            value={c.name}
                            onChange={(e) => handleCellChange(rIdx, 'name', e.target.value)}
                            style={{
                              width: '100%',
                              fontWeight: '600',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--c-navy)',
                              outline: 'none',
                              fontSize: 12
                            }}
                          />
                        </td>

                        {/* Novice Cell */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <textarea
                            value={c.novice}
                            onChange={(e) => handleCellChange(rIdx, 'novice', e.target.value)}
                            style={{
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              fontSize: 11,
                              lineHeight: 1.4,
                              resize: 'none',
                              height: '74px',
                              outline: 'none',
                              color: 'var(--muted)'
                            }}
                          />
                        </td>

                        {/* Developing Cell */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <textarea
                            value={c.developing}
                            onChange={(e) => handleCellChange(rIdx, 'developing', e.target.value)}
                            style={{
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              fontSize: 11,
                              lineHeight: 1.4,
                              resize: 'none',
                              height: '74px',
                              outline: 'none',
                              color: 'var(--muted)'
                            }}
                          />
                        </td>

                        {/* Proficient Cell */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <textarea
                            value={c.proficient}
                            onChange={(e) => handleCellChange(rIdx, 'proficient', e.target.value)}
                            style={{
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              fontSize: 11,
                              lineHeight: 1.4,
                              resize: 'none',
                              height: '74px',
                              outline: 'none',
                              color: 'var(--muted)'
                            }}
                          />
                        </td>

                        {/* Exemplary Cell */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                          <textarea
                            value={c.exemplary}
                            onChange={(e) => handleCellChange(rIdx, 'exemplary', e.target.value)}
                            style={{
                              width: '100%',
                              border: 'none',
                              background: 'transparent',
                              fontSize: 11,
                              lineHeight: 1.4,
                              resize: 'none',
                              height: '74px',
                              outline: 'none',
                              color: 'var(--muted)'
                            }}
                          />
                        </td>

                        {/* Actions Cell */}
                        <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => deleteRow(rIdx)}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', opacity: 0.7 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  )
}
