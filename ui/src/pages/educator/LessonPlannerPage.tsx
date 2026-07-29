import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../services/authService';
import { aiService } from '../../services/aiService';
import type { LessonPlanSchema } from '../../types/aios';
import { 
  Sparkles, BookOpen, ArrowRight, Loader2, CheckCircle2, 
  Share2, AlertCircle, Info, BookOpenCheck, ChevronDown, ChevronUp 
} from 'lucide-react';

export const LessonPlannerPage: React.FC = () => {
  const { me } = useAuth();
  
  // Form State
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('5th Grade');
  const [standardCode, setStandardCode] = useState('');
  
  // Execution State
  const [step, setStep] = useState<'input' | 'generating' | 'output'>('input');
  const [statusText, setStatusText] = useState('Querying District Knowledge Graph...');
  const [error, setError] = useState<string | null>(null);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanSchema | null>(null);
  
  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'phases' | 'differentiation' | 'assessment'>('phases');
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);

  const startGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setError(null);
    setStep('generating');
    setLessonPlan(null);
    setExportSuccess(null);

    const statusSequence = [
      'Querying District Knowledge Graph...',
      'Retrieving Vector Embeddings & Ground-Truth Context...',
      'Analyzing State Standards & Bloom Taxonomy alignment...',
      'Hydrating GPT-4o Schema & generating pedagogical constraints...'
    ];

    let seqIdx = 0;
    const interval = setInterval(() => {
      if (seqIdx < statusSequence.length - 1) {
        seqIdx++;
        setStatusText(statusSequence[seqIdx]);
      }
    }, 2500);

    try {
      const institutionId = me?.institutionId || 'default-inst';
      const plan = await aiService.generateLessonPlan(
        institutionId,
        topic,
        gradeLevel,
        standardCode || 'GEN-K12'
      );
      setLessonPlan(plan);
      setStep('output');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate standards-aligned lesson plan. Please check safety guidelines.');
      setStep('input');
    } finally {
      clearInterval(interval);
    }
  };

  const handleExportToLMS = async () => {
    if (!lessonPlan || !me) return;
    setIsExporting(true);
    setExportSuccess(null);
    setError(null);

    try {
      const questions = lessonPlan.formative_assessment.rubric_criteria.map((criteria, idx) => ({
        question_text: `Rubric Evaluation Item: ${criteria}`,
        question_type: 'multiple_choice',
        options: ['Needs Improvement', 'Approaching Standard', 'Meets Standard', 'Exceeds Standard'],
        correct_answer_index: 2,
        points: 5
      }));

      const res = await aiService.exportToLMS({
        user_id: me.userId,
        institution_id: me.institutionId,
        target_lms: 'canvas',
        payload: {
          title: `${lessonPlan.lesson_title} - Quiz & Rubric`,
          description: `Formative assessment for: ${lessonPlan.learning_objectives.join(', ')}`,
          course_id: 'canvas-course-101',
          questions: questions
        }
      });
      setExportSuccess(`Successfully exported to Canvas LMS! Assignment ID: ${res.external_id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to export to LMS external endpoint.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '24px' }}>
        <h1 className="pageTitle" style={{ fontSize: '26px', color: 'var(--c-navy)', fontFamily: "'Merriweather', Georgia, serif" }}>
          Curriculum Architect
        </h1>
        <p className="pageSub" style={{ fontSize: '13px', marginTop: '4px' }}>
          Generate rigorous, standards-aligned lesson plans grounded in local district database policies.
        </p>
      </header>

      {/* Main Container */}
      <div className="card">
        <div className="cardInner">
          
          {/* Step 1: Form Input */}
          {step === 'input' && (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={startGeneration} 
              className="stack12"
            >
              {error && (
                <div className="toast toastError" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid2">
                <div className="field">
                  <label className="label">GRADE LEVEL</label>
                  <select 
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="select"
                  >
                    <option value="Elementary (3rd Grade)">Elementary (3rd Grade)</option>
                    <option value="5th Grade">5th Grade</option>
                    <option value="Middle School (7th Grade)">Middle School (7th Grade)</option>
                    <option value="High School (Biology)">High School (Biology)</option>
                    <option value="Advanced AP / College">Advanced AP / College</option>
                  </select>
                </div>

                <div className="field">
                  <label className="label">TARGET STANDARDS CODE</label>
                  <input 
                    type="text" 
                    value={standardCode}
                    onChange={(e) => setStandardCode(e.target.value)}
                    placeholder="e.g., NGSS.MS-LS1-1, CCSS.ELA-LITERACY.RL.5.1"
                    className="input"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">INSTRUCTIONAL UNIT OR TOPIC</label>
                <textarea 
                  rows={4}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Explain the lesson concept (e.g. 'Photosynthesis in plant cells and the role of chloroplasts in capturing sunlight')"
                  className="textarea"
                  style={{ minHeight: '120px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button 
                  type="submit"
                  disabled={!topic.trim()}
                  className="btn btnPrimary"
                  style={{ borderRadius: '12px', padding: '10px 20px', fontSize: '13px' }}
                >
                  <span>Compose Lesson Plan</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.form>
          )}

          {/* Step 2: Shimmering Loader */}
          {step === 'generating' && (
            <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
              <Loader2 size={36} style={{ color: 'var(--c-navy)', animation: 'spin 1.2s linear infinite' }} />
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--c-navy)' }}>
                  Architecting Curriculum
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Sparkles size={14} style={{ color: 'var(--c-gold)' }} />
                  {statusText}
                </p>
              </div>
              
              {/* Progress Indicator */}
              <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'rgba(0, 45, 91, 0.08)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 10, ease: 'easeOut' }}
                  style={{ backgroundColor: 'var(--c-navy)', height: '100%', borderRadius: '3px' }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Interactive Output Dashboard */}
          {step === 'output' && lessonPlan && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="stack12"
            >
              {/* Dashboard Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div>
                  <span className="chip" style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--c-navy)', padding: '2px 8px', borderRadius: '4px' }}>
                    {lessonPlan.grade_level} • {lessonPlan.duration_minutes} Minutes
                  </span>
                  <h2 style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: '700', color: 'var(--c-navy)' }}>
                    {lessonPlan.lesson_title}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setStep('input')}
                    className="btn btnGhost"
                    style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '8px' }}
                  >
                    Create Another
                  </button>
                  <button 
                    onClick={handleExportToLMS}
                    disabled={isExporting}
                    className="btn btnPrimary"
                    style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '8px' }}
                  >
                    {isExporting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Share2 size={12} />}
                    <span>Export to Canvas</span>
                  </button>
                </div>
              </div>

              {/* Feedback messages */}
              {exportSuccess && (
                <div className="toast toastOk" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} />
                  <span>{exportSuccess}</span>
                </div>
              )}
              {error && (
                <div className="toast toastError" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Standards info bar */}
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: '12px',
                fontSize: '12px',
                lineHeight: '1.5'
              }}>
                <BookOpenCheck size={20} style={{ color: 'var(--c-navy)', flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontWeight: '700', color: 'var(--c-navy)' }}>Aligned Standards Context</h4>
                  {lessonPlan.aligned_standards.map((std, i) => (
                    <p key={i} style={{ margin: '2px 0 0 0', color: 'var(--text)' }}>
                      <strong>{std.code}</strong> (Bloom Level: {std.bloom_taxonomy_level}) — {std.description}
                    </p>
                  ))}
                </div>
              </div>

              {/* Tab Navigation */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '4px' }}>
                {(['phases', 'differentiation', 'assessment'] as const).map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      color: activeTab === tab ? 'var(--c-navy)' : 'var(--muted)',
                      borderBottom: activeTab === tab ? '2px solid var(--c-navy)' : '2px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab === 'phases' && 'Instructional Phases'}
                    {tab === 'differentiation' && '3-Tier Differentiation'}
                    {tab === 'assessment' && 'Formative Assessment'}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div style={{ paddingTop: '16px', minHeight: '300px' }}>
                
                {/* Tab 1: Phases Accordion */}
                {activeTab === 'phases' && (
                  <div className="stack12">
                    {lessonPlan.instructional_phases.map((phase, idx) => {
                      const isExpanded = expandedPhase === idx;
                      return (
                        <div 
                          key={idx} 
                          style={{
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            backgroundColor: 'rgba(255, 255, 255, 0.4)'
                          }}
                        >
                          <button 
                            onClick={() => setExpandedPhase(isExpanded ? null : idx)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 20px',
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0, 45, 91, 0.08)',
                                color: 'var(--c-navy)',
                                fontSize: '11px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {idx + 1}
                              </span>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                                  {phase.phase_name}
                                </h4>
                                <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted)' }}>
                                  Duration: {phase.duration_minutes} mins
                                </p>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{
                                  padding: '16px 20px 20px 20px',
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                  gap: '16px',
                                  fontSize: '12px',
                                  lineHeight: '1.5',
                                  borderTop: '1px solid var(--border)',
                                  backgroundColor: 'rgba(255, 255, 255, 0.25)'
                                }}>
                                  <div>
                                    <h5 style={{ margin: '0 0 6px 0', fontWeight: '700', color: 'var(--c-navy)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                      Teacher Actions
                                    </h5>
                                    <p style={{ margin: 0, color: 'var(--text)' }}>
                                      {phase.teacher_actions}
                                    </p>
                                  </div>
                                  <div>
                                    <h5 style={{ margin: '0 0 6px 0', fontWeight: '700', color: '#16a34a', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                      Student Actions
                                    </h5>
                                    <p style={{ margin: 0, color: 'var(--text)' }}>
                                      {phase.student_actions}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tab 2: Differentiation Matrix */}
                {activeTab === 'differentiation' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {lessonPlan.instructional_phases.map((phase, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(255, 255, 255, 0.4)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--c-navy)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                          {phase.phase_name} Scaffolding
                        </h4>
                        <div className="stack12" style={{ fontSize: '11px', lineHeight: '1.45' }}>
                          <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(220, 38, 38, 0.04)', border: '1px solid rgba(220, 38, 38, 0.1)' }}>
                            <strong style={{ color: '#dc2626', display: 'block', marginBottom: '2px' }}>Remediation Tier</strong>
                            <span>{phase.differentiation_notes.remediation}</span>
                          </div>
                          <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(0, 45, 91, 0.04)', border: '1px solid rgba(0, 45, 91, 0.1)' }}>
                            <strong style={{ color: 'var(--c-navy)', display: 'block', marginBottom: '2px' }}>On-Level Tier</strong>
                            <span>{phase.differentiation_notes.on_level}</span>
                          </div>
                          <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.04)', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                            <strong style={{ color: '#16a34a', display: 'block', marginBottom: '2px' }}>Extension Tier</strong>
                            <span>{phase.differentiation_notes.extension}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Formative Assessment */}
                {activeTab === 'assessment' && (
                  <div className="stack12">
                    <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.4)', border: '1px solid var(--border)' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: 'var(--c-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={16} />
                        <span>Assessment Method</span>
                      </h3>
                      <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', color: 'var(--text)' }}>
                        {lessonPlan.formative_assessment.method}
                      </p>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.02em' }}>
                        Rubric Criteria (AI-Generated & Exportable)
                      </h4>
                      <ul style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '12px',
                        padding: 0,
                        margin: 0,
                        listStyle: 'none'
                      }}>
                        {lessonPlan.formative_assessment.rubric_criteria.map((criteria, i) => (
                          <li 
                            key={i}
                            style={{
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              backgroundColor: 'rgba(255, 255, 255, 0.4)',
                              fontSize: '12px',
                              color: 'var(--text)',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              lineHeight: '1.45'
                            }}
                          >
                            <Info size={14} style={{ color: 'var(--c-navy)', flexShrink: 0, marginTop: '2px' }} />
                            <span>{criteria}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
};
