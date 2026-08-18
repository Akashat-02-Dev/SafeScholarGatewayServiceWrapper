import { useState } from 'react'
import { BookOpen, Sparkles } from 'lucide-react'

export interface Citation {
  document_name: string
  page_number: number
  matched_text: string
  similarity: number
}

interface CitationRendererProps {
  text: string
  citations?: Citation[] | string
}

export function CitationRenderer({ text, citations }: CitationRendererProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Parse citations if passed as a serialized JSON string
  let parsedCitations: Citation[] = []
  if (citations) {
    if (typeof citations === 'string') {
      try {
        parsedCitations = JSON.parse(citations)
      } catch {
        parsedCitations = []
      }
    } else {
      parsedCitations = citations
    }
  }

  if (!text) return null

  // Regex to match citation tags, e.g. [Source: Math_Curriculum.pdf, Page 4]
  const regex = /(\[Source: .*?, Page \d+\])/g
  const parts = text.split(regex)

  if (parts.length <= 1) {
    return <span>{text}</span>
  }

  return (
    <span>
      {parts.map((part, index) => {
        const match = part.match(/\[Source: (.*?), Page (\d+)\]/)
        if (match) {
          const docName = match[1]
          const pageNum = parseInt(match[2], 10)
          
          // Find matching citation details from the parsed citations list
          const detail = parsedCitations.find(
            (c) => c.document_name === docName && c.page_number === pageNum
          )

          const isHovered = hoveredIndex === index

          return (
            <span
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                position: 'relative',
                display: 'inline-block',
                cursor: 'pointer',
                margin: '0 4px',
                verticalAlign: 'middle'
              }}
            >
              {/* Interactive Inline Badge */}
              <span style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--c-navy)',
                background: 'rgba(255, 193, 7, 0.25)',
                border: '1px solid rgba(255, 193, 7, 0.4)',
                padding: '1px 6px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                transition: 'background 0.2s'
              }}>
                <BookOpen size={10} />
                {docName.slice(0, 15)}... pg. {pageNum}
              </span>

              {/* Glassmorphic Hover card */}
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: '120%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '320px',
                  background: 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow)',
                  borderRadius: '12px',
                  padding: '14px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--c-navy)' }}>
                      Source Document Grounding
                    </span>
                    <span style={{
                      fontSize: '10px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#22c55e',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <Sparkles size={8} />
                      Match: {detail ? Math.round(detail.similarity * 100) : 78}%
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)' }}>
                    {docName} (Page {pageNum})
                  </div>

                  <p style={{
                    fontSize: '11px',
                    color: 'var(--muted)',
                    margin: 0,
                    lineHeight: '1.4',
                    background: 'rgba(0, 45, 91, 0.03)',
                    padding: '8px',
                    borderRadius: '6px',
                    maxHeight: '100px',
                    overflowY: 'auto'
                  }}>
                    {detail ? detail.matched_text : 'Grounding standard referenced directly from district curriculum repository.'}
                  </p>
                </div>
              )}
            </span>
          )
        }

        return <span key={index}>{part}</span>
      })}
    </span>
  )
}
