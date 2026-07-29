import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Video, Sparkles, CheckCircle2, Eye, EyeOff, Film, Clock } from 'lucide-react'
import { useAuth } from '../../services/authService'
import { aiService } from '../../services/aiService'

interface QuizQuestion {
  timestamp: string
  question: string
  options: string[]
  answer: string
  explanation: string
}

export default function VideoAssessor() {
  const { me } = useAuth()
  const institutionId = me?.institutionId || 'default'

  // Inputs
  const [videoUrl, setVideoUrl] = useState('')
  const [numQuestions, setNumQuestions] = useState(3)

  // Loading states & stages
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // Output results
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [visibleAnswers, setVisibleAnswers] = useState<Record<number, boolean>>({})

  const loadingStages = [
    "Extracting video details & transcripts...",
    "Engaging Whisper audio-to-text alignment...",
    "Formulating Bloom's Taxonomy assessment schema..."
  ]

  useEffect(() => {
    if (!isLoading) return
    const timer = setInterval(() => {
      setLoadingStage((prev) => (prev < loadingStages.length - 1 ? prev + 1 : prev))
    }, 2000)
    return () => clearInterval(timer)
  }, [isLoading])

  function validateYouTubeUrl(url: string): boolean {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return !!(match && match[2].length === 11)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!videoUrl.trim()) return
    if (!validateYouTubeUrl(videoUrl)) {
      setErr("Please enter a valid YouTube video link (e.g. youtube.com/watch?v=... or youtu.be/...)")
      return
    }

    setIsLoading(true)
    setLoadingStage(0)
    setErr(null)
    setOk(null)
    setQuestions([])
    setVisibleAnswers({})

    try {
      const payload = {
        tool_id: 'video_question_maker' as const,
        institution_id: institutionId,
        parameters: {
          user_prompt: videoUrl,
          num_questions: numQuestions
        }
      }
      
      const res = await aiService.executeTool<typeof payload.parameters, string>(
        'video-question-maker',
        payload
      )
      
      const parsed = JSON.parse(res.response_text) as QuizQuestion[]
      setQuestions(parsed)
      setOk('YouTube transcript parsed successfully and formatted as timeline questions.')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'failed to process video assessment')
    } finally {
      setIsLoading(false)
    }
  }

  function toggleAnswer(idx: number) {
    setVisibleAnswers(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card">
        <div className="cardInner">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <Video size={20} />
            </div>
            <div>
              <h2 className="pageTitle">YouTube Video Question Maker</h2>
              <div className="pageSub">Instantly generate standards-grounded classroom assessments directly from video transcripts.</div>
            </div>
          </div>

          {err ? <div className="toast toastError" style={{ marginTop: 12 }}>{err}</div> : null}
          {ok ? <div className="toast toastOk" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}><CheckCircle2 size={18} /> {ok}</div> : null}

          {/* Form */}
          <form onSubmit={handleGenerate} style={{ marginTop: 20 }}>
            <div className="grid2">
              <div className="field">
                <div className="label">YouTube Video URL</div>
                <div style={{ position: 'relative' }}>
                  <Film size={18} style={{ position: 'absolute', left: 12, top: 12, opacity: 0.65 }} />
                  <input
                    className="input"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    required
                    disabled={isLoading}
                    style={{ paddingLeft: 40 }}
                  />
                </div>
              </div>

              <div className="field">
                <div className="label">Target Question Count</div>
                <select
                  className="select"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  disabled={isLoading}
                >
                  {[3, 5, 7, 10].map(n => (
                    <option key={n} value={n}>{n} Questions</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btnPrimary" style={{ marginTop: 16 }} disabled={isLoading || !videoUrl.trim()}>
              <Sparkles size={16} />
              {isLoading ? 'Processing Video...' : 'Parse Video & Generate Quiz'}
            </button>
          </form>

          {/* Pipeline Loading sequence */}
          {isLoading && (
            <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0', borderTop: '1px solid var(--border)' }}>
              <div className="brandMark" style={{ width: 44, height: 44, animation: 'spin 2s linear infinite' }}>
                <Sparkles size={20} />
              </div>
              <div style={{ fontWeight: '600', color: 'var(--c-navy)', fontSize: 14 }}>
                {loadingStages[loadingStage]}
              </div>
              <div style={{ width: '200px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${(loadingStage + 1) * 33.3}%`, height: '100%', background: 'var(--c-navy)', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {/* Question Results list */}
          {questions.length > 0 && (
            <div style={{ marginTop: 30, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <h3 style={{ color: 'var(--c-navy)', fontSize: 16, margin: '0 0 16px 0' }}>Generated Multiple-Choice Assessment</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {questions.map((q, idx) => {
                  const showAnswer = !!visibleAnswers[idx]
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: 16,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'rgba(255, 255, 255, 0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
                      {/* Question Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="chip" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0, 45, 91, 0.05)', color: 'var(--c-navy)' }}>
                            <Clock size={12} />
                            Timestamp {q.timestamp}
                          </span>
                          <span style={{ fontWeight: '600', fontSize: 13, color: 'var(--c-navy)' }}>
                            Question {idx + 1}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btnGhost"
                          onClick={() => toggleAnswer(idx)}
                          style={{ padding: '4px 8px', fontSize: 11, height: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          {showAnswer ? <EyeOff size={14} /> : <Eye size={14} />}
                          {showAnswer ? 'Hide Answer Key' : 'Reveal Answer Key'}
                        </button>
                      </div>

                      {/* Question Text */}
                      <div style={{ fontSize: 13, fontWeight: '500', color: 'var(--c-navy)' }}>
                        {q.question}
                      </div>

                      {/* Options Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = opt === q.answer
                          return (
                            <div
                              key={oIdx}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-sm)',
                                border: isCorrect && showAnswer ? '1px solid #16a34a' : '1px solid var(--border)',
                                background: isCorrect && showAnswer ? 'rgba(34, 197, 94, 0.04)' : '#fff',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  border: '1px solid var(--border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 'bold',
                                  background: isCorrect && showAnswer ? '#16a34a' : 'none',
                                  color: isCorrect && showAnswer ? '#fff' : 'var(--muted)'
                                }}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Distractor & Answer Key info */}
                      {showAnswer && (
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(34, 197, 94, 0.02)',
                            borderLeft: '3px solid #16a34a',
                            fontSize: 12,
                            marginTop: 4
                          }}
                        >
                          <div style={{ color: '#16a34a', fontWeight: 'bold' }}>Correct Answer: {q.answer}</div>
                          <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                            <strong>Explanation:</strong> {q.explanation}
                          </div>
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  )
}
