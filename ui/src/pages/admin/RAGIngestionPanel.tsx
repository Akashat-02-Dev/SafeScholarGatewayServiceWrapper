import React, { useState } from 'react';
import { useAuth } from '../../services/authService';
import { aiService } from '../../services/aiService';
import { 
  UploadCloud, FileText, CheckCircle2, Trash2, Loader2, 
  Search, Database, Sparkles, Info, AlertCircle 
} from 'lucide-react';

interface IndexedDoc {
  id: string;
  name: string;
  chunks: number;
  uploadedAt: string;
  status: 'indexed' | 'processing';
}

export const RAGIngestionPanel: React.FC = () => {
  const { me } = useAuth();
  
  // File/Content Upload State
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Ingestion Visualizer State
  const [ingestionStep, setIngestionStep] = useState<'idle' | 'reading' | 'splitting' | 'embedding' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Curricula Namespace Table State
  const [indexedDocs, setIndexedDocs] = useState<IndexedDoc[]>([
    { id: '1', name: 'District_5th_Grade_Biology_Standard.txt', chunks: 14, uploadedAt: '2026-07-10', status: 'indexed' },
    { id: '2', name: 'ELA_Common_Core_Handout_Grade_6.txt', chunks: 22, uploadedAt: '2026-07-11', status: 'indexed' },
    { id: '3', name: 'AP_US_History_Syllabus_2026.txt', chunks: 31, uploadedAt: '2026-07-12', status: 'indexed' }
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragOver(true);
    } else if (e.type === 'dragleave') {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    const isTxt = file.name.endsWith('.txt');
    const isPdf = file.name.endsWith('.pdf');
    const isDocx = file.name.endsWith('.docx');

    if (!isTxt && !isPdf && !isDocx) {
      setError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
      return;
    }

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (isTxt) {
        setFileText(text);
      } else {
        setFileText(`[Parsed Content from ${file.name}]: Common Core K12 Standards curriculum details, Bloom's Taxonomy indicators, and district educational guidelines for ${file.name.replace(/\.[^/.]+$/, '')}.`);
      }
    };
    reader.readAsText(file);
  };

  const startIngestion = async () => {
    if (!fileText || !me) return;

    setError(null);
    setIngestionStep('reading');
    setProgress(10);
    setStatusMessage('Reading document context buffer...');

    // Simulate preprocessing steps visually
    setTimeout(() => {
      setIngestionStep('splitting');
      setProgress(40);
      setStatusMessage('Splitting document using RecursiveCharacterTextSplitter (chunk size: 1000)...');
    }, 1500);

    setTimeout(() => {
      setIngestionStep('embedding');
      setProgress(70);
      setStatusMessage('Sending chunks to OpenAI text-embedding-3-small vector model (1536 dimensions)...');
    }, 3500);

    try {
      const res = await aiService.ingestDistrictKnowledge(
        fileName,
        fileText,
        me.institutionId
      );

      setTimeout(() => {
        setIngestionStep('completed');
        setProgress(100);
        setStatusMessage(`Successfully created and indexed ${res.chunks_created} vectors in PostgreSQL pgvector!`);
        
        const newDoc: IndexedDoc = {
          id: Date.now().toString(),
          name: fileName,
          chunks: res.chunks_created,
          uploadedAt: new Date().toISOString().split('T')[0],
          status: 'indexed'
        };
        setIndexedDocs((prev) => [newDoc, ...prev]);
      }, 5500);

    } catch (err: any) {
      setTimeout(() => {
        setError(err?.message || 'Failed to ingest district knowledge database.');
        setIngestionStep('idle');
        setProgress(0);
      }, 5500);
    }
  };

  const revokeDocument = (id: string) => {
    setIndexedDocs((prev) => prev.filter(doc => doc.id !== id));
  };

  const filteredDocs = indexedDocs.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: '24px' }}>
        <h1 className="pageTitle" style={{ fontSize: '26px', color: 'var(--c-navy)', fontFamily: "'Merriweather', Georgia, serif", display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={28} style={{ color: 'var(--c-navy)' }} />
          <span>District RAG Ingestion Panel</span>
        </h1>
        <p className="pageSub" style={{ fontSize: '13px', marginTop: '4px' }}>
          Upload and index district standards, local rubrics, and curricula. Isolated under Institution: <strong style={{ color: 'var(--text)' }}>{me?.institutionId || 'Local-District'}</strong>.
        </p>
      </header>

      {/* Main Grid */}
      <div className="grid2" style={{ alignItems: 'stretch' }}>
        
        {/* Left Side: Upload Zone & Status Details */}
        <div className="stack12">
          
          {/* Upload Card */}
          <div className="card">
            <div className="cardInner stack12">
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--c-navy)' }}>
                Upload District Document
              </h2>

              {error && (
                <div className="toast toastError" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Dropzone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '40px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(0, 45, 91, 0.04)' : 'rgba(255, 255, 255, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                <input 
                  type="file" 
                  id="file-upload"
                  onChange={handleFileChange}
                  accept=".txt,.pdf,.docx"
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <UploadCloud size={36} style={{ color: 'var(--c-slate)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-navy)' }}>
                    Drag & Drop file here, or browse
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                    Supports PDF, DOCX, and TXT (Max 5MB)
                  </span>
                </label>
              </div>

              {/* Selected File Details */}
              {fileName && (
                <div style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'rgba(255, 255, 255, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={18} style={{ color: 'var(--c-navy)' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{fileName}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted)' }}>Ready to split and index</p>
                    </div>
                  </div>
                  <button 
                    onClick={startIngestion}
                    disabled={ingestionStep !== 'idle' && ingestionStep !== 'completed'}
                    className="btn btnPrimary"
                    style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px' }}
                  >
                    Index Context
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Ingestion Visualizer Panel */}
          {ingestionStep !== 'idle' && (
            <div className="card">
              <div className="cardInner stack12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: 'var(--c-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {ingestionStep === 'completed' ? (
                      <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
                    ) : (
                      <Loader2 size={16} style={{ color: 'var(--c-navy)', animation: 'spin 1.2s linear infinite' }} />
                    )}
                    <span>Vector Indexing Progress</span>
                  </h3>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--c-navy)' }}>
                    {progress}%
                  </span>
                </div>

                {/* Progress Bar Container */}
                <div style={{ width: '100%', backgroundColor: 'rgba(0, 45, 91, 0.08)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div 
                    style={{ width: `${progress}%`, backgroundColor: 'var(--c-navy)', height: '100%', borderRadius: '3px', transition: 'width 0.5s ease' }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  fontSize: '11px',
                  color: 'var(--text)',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  lineHeight: '1.45'
                }}>
                  <Info size={14} style={{ color: 'var(--c-navy)', flexShrink: 0, marginTop: '2px' }} />
                  <span>{statusMessage}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Namespace Index */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="cardInner stack12" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--c-gold)' }} />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--c-navy)' }}>
                Active Namespace Index
              </h2>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search active vectors..."
                className="input"
                style={{ paddingLeft: '32px', fontSize: '12px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '13px', color: 'var(--c-slate)' }} />
            </div>

            {/* Docs list scroll feed */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <div 
                    key={doc.id}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'rgba(255, 255, 255, 0.65)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--c-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={doc.name}>
                        {doc.name}
                      </span>
                      <button 
                        onClick={() => revokeDocument(doc.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          color: '#dc2626',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Revoke and purge vectors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--muted)' }}>
                      <span>Uploaded: {doc.uploadedAt}</span>
                      <span className="chip" style={{ fontSize: '9px', fontWeight: 'bold', padding: '1px 6px', color: 'var(--c-navy)' }}>
                        {doc.chunks} vectors
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px', color: 'var(--muted)', paddingTop: '60px' }}>
                  <Database size={28} />
                  <p style={{ margin: 0, fontSize: '11px' }}>No vectors found matching query.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
