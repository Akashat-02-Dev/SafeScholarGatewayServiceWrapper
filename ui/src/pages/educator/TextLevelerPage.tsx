import React, { useState } from 'react';
import { useAuth } from '../../services/authService';
import { aiService } from '../../services/aiService';
import { Sparkles, Loader2, AlertCircle, FileText, Settings, RefreshCw } from 'lucide-react';

const GRADE_LEVELS = [
  'Grade 1 (Lexile 190L-530L)',
  'Grade 2 (Lexile 420L-650L)',
  'Grade 3 (Lexile 520L-820L)',
  'Grade 4 (Lexile 740L-940L)',
  'Grade 5 (Lexile 830L-1010L)',
  'Grade 6 (Lexile 925L-1070L)',
  'Grade 7 (Lexile 970L-1120L)',
  'Grade 8 (Lexile 1010L-1185L)',
  'Grade 9 (Lexile 1050L-1260L)',
  'Grade 10 (Lexile 1080L-1335L)',
  'Grade 11 (Lexile 1185L-1385L)',
  'Grade 12 (Lexile 1215L-1440L)',
  'AP / College Prep (Lexile 1400L+)'
];

export const TextLevelerPage: React.FC = () => {
  const { me } = useAuth();
  
  // Controls state
  const [sourceText, setSourceText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [gradeIndex, setGradeIndex] = useState(4); // Default to Grade 5
  
  // Execution state
  const [isLeveling, setIsLeveling] = useState(false);
  const [leveledText, setLeveledText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLevelText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceText.trim() && !urlInput.trim()) return;

    setError(null);
    setIsLeveling(true);
    setLeveledText('');

    try {
      const institutionId = me?.institutionId || 'default-inst';
      const targetGrade = GRADE_LEVELS[gradeIndex];
      
      const payload = {
        tool_id: 'leveler' as const,
        institution_id: institutionId,
        parameters: {
          user_prompt: `Please simplify and level the following text to fit ${targetGrade}. Highlight key academic vocabulary terms in bold or format them cleanly.`,
          source_text: sourceText,
          source_url: urlInput,
          target_level: targetGrade
        }
      };

      const res = await aiService.executeTool<any, string>('leveler', payload);
      setLeveledText(res.response_text);
    } catch (err: any) {
      setError(err?.message || 'Failed to level target text. Please verify safety guardrail compliance.');
    } finally {
      setIsLeveling(false);
    }
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    
    const words = text.split(/(\s+)/);
    return words.map((word, idx) => {
      const isBold = word.startsWith('**') && word.endsWith('**');
      const cleanWord = isBold ? word.slice(2, -2) : word;
      
      const isAcademic = /explain|analysis|discover|hypothesize|chloroplast|concept|process/i.test(cleanWord);
      
      if (isBold) {
        return (
          <strong key={idx} style={{
            color: 'var(--c-navy)',
            backgroundColor: 'rgba(255, 193, 7, 0.16)',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 193, 7, 0.28)'
          }}>
            {cleanWord}
          </strong>
        );
      }
      
      if (isAcademic) {
        return (
          <span key={idx} style={{
            backgroundColor: 'rgba(0, 45, 91, 0.08)',
            color: 'var(--c-navy)',
            fontWeight: '600',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid rgba(0, 45, 91, 0.14)'
          }}>
            {cleanWord}
          </span>
        );
      }
      
      return <React.Fragment key={idx}>{word}</React.Fragment>;
    });
  };

  return (
    <div className="page" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '24px' }}>
        <h1 className="pageTitle" style={{ fontSize: '26px', color: 'var(--c-navy)', fontFamily: "'Merriweather', Georgia, serif" }}>
          Text Leveler & Differentiator
        </h1>
        <p className="pageSub" style={{ fontSize: '13px', marginTop: '4px' }}>
          Adjust the reading complexity of any educational material to match district Lexile standard requirements.
        </p>
      </header>

      {/* Split-Screen Grid Layout */}
      <div className="grid2" style={{ alignItems: 'stretch' }}>
        
        {/* Left Card: Input Form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="cardInner stack12" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '8px' }}>
              <FileText size={18} style={{ color: 'var(--c-navy)' }} />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--c-navy)' }}>
                Source Text Ingestion
              </h2>
            </div>

            <form onSubmit={handleLevelText} className="stack12" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {error && (
                <div className="toast toastError" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="field">
                <label className="label">OPTIONAL: URL REFERENCE LINK</label>
                <input 
                  type="url" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article-to-level"
                  className="input"
                />
              </div>

              <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="label">RAW TEXT CONTENT</label>
                <textarea 
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Paste the source text chapter, article, or handout context here..."
                  className="textarea"
                  style={{ flex: 1, minHeight: '220px' }}
                  required={!urlInput.trim()}
                />
              </div>

              {/* Lexile Grade Slider */}
              <div className="field" style={{ paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Settings size={12} />
                    TARGET COMPLEXITY LEVEL
                  </span>
                  <span className="chip" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--c-navy)', padding: '2px 8px' }}>
                    {GRADE_LEVELS[gradeIndex]}
                  </span>
                </div>
                <input 
                  type="range" 
                  min={0}
                  max={GRADE_LEVELS.length - 1}
                  value={gradeIndex}
                  onChange={(e) => setGradeIndex(Number(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--c-navy)',
                    height: '6px',
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="submit"
                  disabled={isLeveling || (!sourceText.trim() && !urlInput.trim())}
                  className="btn btnPrimary"
                  style={{ borderRadius: '12px', padding: '10px 20px', fontSize: '13px' }}
                >
                  {isLeveling ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Differentiating...</span>
                    </>
                  ) : (
                    <>
                      <span>Execute Leveler</span>
                      <Sparkles size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Card: Output */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="cardInner stack12" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--c-gold)' }} />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--c-navy)' }}>
                  Differentiated Output
                </h2>
              </div>
              {leveledText && (
                <button 
                  onClick={() => setLeveledText('')}
                  className="btn btnGhost iconBtn"
                  style={{ width: '28px', height: '28px', borderRadius: '8px' }}
                  title="Clear Output"
                >
                  <RefreshCw size={12} />
                </button>
              )}
            </div>

            <div style={{
              flex: 1,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid var(--border)',
              padding: '20px',
              overflowY: 'auto',
              minHeight: '350px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--text)',
              whiteSpace: 'pre-wrap'
            }}>
              {isLeveling ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', itemsAlign: 'center', justifyContent: 'center', textAlign: 'center', gap: '10px', paddingTop: '100px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Loader2 size={32} style={{ color: 'var(--c-navy)', animation: 'spin 1.2s linear infinite' }} />
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    Rewriting syntax structures to match target Lexile level...
                  </p>
                </div>
              ) : leveledText ? (
                <div style={{ fontFamily: 'system-ui, sans-serif' }}>
                  {renderHighlightedText(leveledText)}
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px', color: 'var(--muted)', paddingTop: '80px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.7 }}>
                    <Settings size={36} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>Waiting for Execution</h3>
                  <p style={{ margin: 0, fontSize: '11px', maxWidth: '240px' }}>
                    Paste content into the left ingestion panel, adjust the Lexile complexity slider, and run the Leveler.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
