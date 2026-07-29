import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Send, GraduationCap, CheckCircle2, CloudUpload, Sparkles } from 'lucide-react'
import { useAuth } from '../../services/authService'
import { aiService } from '../../services/aiService'
import type { LessonPlanSchema } from '../../types/aios'

export default function LessonPlanner() {
  const { me } = useAuth()
  const institutionId = me?.institutionId || 'default'

  // Input states
  const [topic, setTopic] = useState('')
  const [gradeLevel, setGradeLevel] = useState('Grade 6')
  const [standardCode, setStandardCode] = useState('')

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // Result state
  const [lessonPlan, setLessonPlan] = useState<LessonPlanSchema | null>(null)
  const [activeTab, setActiveTab] = useState<'objectives' | 'phases' | 'differentiation'>('objectives')
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setIsLoading(true)
    setErr(null)
    setOk(null)
    setLessonPlan(null)

    try {
      const data = await aiService.generateLessonPlan(
        institutionId,
        topic,
        gradeLevel,
        standardCode
      )
      setLessonPlan(data)
      setOk('Lesson plan generated successfully using standards grounding.')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'failed to generate lesson plan')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleExport() {
    if (!lessonPlan) return
    setIsExporting(true)
    setErr(null)
    setOk(null)

    try {
      const payload = {
        title: lessonPlan.lesson_title,
        description: `Aligned Standards: ${lessonPlan.aligned_standards?.map(s => s.code).join(', ')}`,
        lms_provider: 'canvas' as const,
        quiz_data: {
          title: `${lessonPlan.lesson_title} Assessment`,
          description: `Formative assessment for ${lessonPlan.lesson_title}`,
          questions: [
            {
              question_text: `Which primary standard code does this align to?`,
              question_type: 'multiple_choice' as const,
              points: 5,
              options: [
                lessonPlan.aligned_standards?.[0]?.code || 'Selected Standard',
                'General Standard',
                'Unrelated standard'
              ],
              correct_answer: lessonPlan.aligned_standards?.[0]?.code || 'Selected Standard'
            }
          ]
        }
      }
      
      const res = await aiService.exportToLMS(payload)
      setOk(`Successfully exported lesson quiz shell to Canvas LMS! External ID: ${res.external_id}`)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'failed to export to LMS')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card">
        <div className="cardInner">
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="pageTitle">Lesson Planner</h2>
              <div className="pageSub">Build rigorous, standards-aligned unit plans grounded in district educational rubrics.</div>
            </div>
          </div>

          {err ? <div className="toast toastError" style={{ marginTop: 12 }}>{err}</div> : null}
          {ok ? <div className="toast toastOk" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Form */}
          <form onSubmit={handleGenerate} style={{ marginTop: 20 }}>
            <div className="grid2">
              <div className="field">
                <div className="label">Topic / Subject Matter</div>
                <input
                  className="input"
                  placeholder="e.g. Photosynthesis, Quadratic Equations..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <div className="label">Grade Level</div>
                  <select
                    className="select"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    disabled={isLoading}
                  >
                    {['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <div className="label">Standards Code</div>
                  <input
                    className="input"
                    placeholder="e.g. MS-LS1-1, CCSS.Math.6.EE..."
                    value={standardCode}
                    onChange={(e) => setStandardCode(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btnPrimary" style={{ marginTop: 16 }} disabled={isLoading || !topic.trim()}>
              <Sparkles size={16} />
              {isLoading ? 'Generating Plan...' : 'Generate Standards Lesson'}
            </button>
          </form>

          {/* Result view */}
          {lessonPlan ? (
            <div style={{ marginTop: 30, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--c-navy)', fontSize: 20 }}>{lessonPlan.lesson_title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Grade: <strong>{lessonPlan.grade_level}</strong> | Duration: <strong>{lessonPlan.duration_minutes} minutes</strong>
                  </div>
                </div>
                <button className="btn btnGhost" style={{ borderColor: 'var(--border)' }} onClick={() => void handleExport()} disabled={isExporting}>
                  <CloudUpload size={16} />
                  {isExporting ? 'Exporting to Canvas...' : 'Export to Canvas LMS'}
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginTop: 20, paddingBottom: 1 }}>
                {(['objectives', 'phases', 'differentiation'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab ? '2px solid var(--c-navy)' : '2px solid transparent',
                      color: activeTab === tab ? 'var(--c-navy)' : 'var(--muted)',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div style={{ marginTop: 16 }}>
                
                {/* Objectives */}
                {activeTab === 'objectives' && (
                  <div className="stack12">
                    <div style={{ padding: 16, background: 'rgba(255,255,255,0.4)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--c-navy)' }}>Aligned Standards</h4>
                      {lessonPlan.aligned_standards?.map((s, idx) => (
                        <div key={idx} style={{ fontSize: 13, marginBottom: 8, display: 'flex', gap: 8 }}>
                          <span className="chip" style={{ fontSize: 10, alignSelf: 'flex-start' }}>{s.code}</span>
                          <div>
                            <div>{s.description}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Cognitive Level: {s.bloom_taxonomy_level}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: 16, background: 'rgba(255,255,255,0.4)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--c-navy)' }}>Learning Objectives</h4>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                        {lessonPlan.learning_objectives?.map((o, idx) => (
                          <li key={idx} style={{ marginBottom: 4 }}>{o}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ padding: 16, background: 'rgba(255,255,255,0.4)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--c-navy)' }}>Essential Questions</h4>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                        {lessonPlan.essential_questions?.map((q, idx) => (
                          <li key={idx} style={{ marginBottom: 4 }}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Phases */}
                {activeTab === 'phases' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {lessonPlan.instructional_phases?.map((p, idx) => {
                      const isExpanded = expandedPhase === idx
                      return (
                        <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <div
                            onClick={() => setExpandedPhase(isExpanded ? null : idx)}
                            style={{
                              padding: '12px 16px',
                              background: 'rgba(0, 45, 91, 0.02)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontWeight: 600,
                              fontSize: 13,
                              color: 'var(--c-navy)'
                            }}
                          >
                            <span>{p.phase_name} ({p.duration_minutes} mins)</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{isExpanded ? 'Collapse' : 'Expand'}</span>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: 16, background: '#fff', borderTop: '1px solid var(--border)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div><strong>Teacher Actions:</strong> <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>{p.teacher_actions}</p></div>
                              <div><strong>Student Actions:</strong> <p style={{ margin: '4px 0 0 0', color: 'var(--muted)' }}>{p.student_actions}</p></div>
                              {p.differentiation_notes && (
                                <div style={{ background: 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 6, marginTop: 4 }}>
                                  <strong style={{ fontSize: 11 }}>Differentiation Notes:</strong>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 6, fontSize: 11 }}>
                                    <div><span style={{ fontWeight: 600 }}>Remediation:</span> {p.differentiation_notes.remediation}</div>
                                    <div><span style={{ fontWeight: 600 }}>On-Level:</span> {p.differentiation_notes.on_level}</div>
                                    <div><span style={{ fontWeight: 600 }}>Extension:</span> {p.differentiation_notes.extension}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Differentiation */}
                {activeTab === 'differentiation' && (
                  <div className="grid2" style={{ alignItems: 'stretch' }}>
                    <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.03)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: 13 }}>Remediation (Tiers 2 & 3)</h4>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
                        Focus on scaffolding with guided models, explicit sentence frames, concrete manipulatives, and regular vocabulary retrieval checks.
                      </p>
                    </div>
                    <div style={{ padding: 16, background: 'rgba(34, 197, 94, 0.03)', borderRadius: 8, border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#16a34a', fontSize: 13 }}>On-Level (Tier 1 Core)</h4>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
                        Standard direct instruction coupled with collaborative peer learning models, inquiry-driven problem solving, and standard exit tickets.
                      </p>
                    </div>
                    <div style={{ padding: 16, background: 'rgba(59, 130, 246, 0.03)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#2563eb', fontSize: 13 }}>Extension (Enrichment)</h4>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
                        Integrate project-based extension questions, self-driven research prompts, alternate representation models, and high cognitive-tier Bloom analysis.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : null}

        </div>
      </div>
    </motion.div>
  )
}
