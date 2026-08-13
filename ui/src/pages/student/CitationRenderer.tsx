import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface CitationRendererProps {
  text: string;
}

export function CitationRenderer({ text }: CitationRendererProps) {
  // Regex to match [Source: DocName, Chunk X] or [Source: DocName, Page X]
  const citationRegex = /\[Source:\s*([^,]+),\s*(?:Chunk|Page)\s*([^\]]+)\]/g;
  
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    const docName = match[1].trim();
    const loc = match[2].trim();
    
    // Add text before citation
    if (match.index > lastIndex) {
      segments.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    
    // Add interactive citation pill
    segments.push(
      <CitationPill key={`cit-${match.index}`} docName={docName} location={loc} />
    );
    
    lastIndex = citationRegex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    segments.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  if (segments.length === 0) {
    return <span>{text}</span>;
  }

  return <span className="whitespace-pre-wrap">{segments}</span>;
}

function CitationPill({ docName, location }: { docName: string, location: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-block mx-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer align-middle"
        title="View Source"
      >
        <BookOpen size={12} />
        <span>{location}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-slate-800 text-sm break-words">{docName}</h4>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Institution verified document chunk: {location}.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
