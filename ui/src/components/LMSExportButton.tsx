import { useState } from 'react';
import { Check, ExternalLink, Code } from 'lucide-react';

interface LMSExportButtonProps {
  contentHtml: string;
  courseId?: string;
}

export function LMSExportButton({ contentHtml, courseId = "default-course" }: LMSExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'pushing' | 'success_copy' | 'success_push' | 'error'>('idle');

  const handleCopyHtml = async () => {
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(contentHtml);
      setStatus('success_copy');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handlePushToLMS = async () => {
    setStatus('pushing');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/lms/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: 'canvas',
          course_id: courseId,
          html_content: contentHtml
        })
      });

      if (!response.ok) {
        throw new Error("Failed to push to LMS");
      }
      
      setStatus('success_push');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200/50">
      <button
        onClick={handleCopyHtml}
        disabled={status !== 'idle'}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
      >
        {status === 'success_copy' ? (
          <><Check className="w-4 h-4 text-emerald-500" /> Copied HTML!</>
        ) : (
          <><Code className="w-4 h-4" /> Copy as HTML</>
        )}
      </button>

      <button
        onClick={handlePushToLMS}
        disabled={status !== 'idle'}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
      >
        {status === 'pushing' ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : status === 'success_push' ? (
          <Check className="w-4 h-4" />
        ) : (
          <ExternalLink className="w-4 h-4" />
        )}
        {status === 'success_push' ? 'Pushed to LMS!' : 'Push to Canvas/Schoolbox'}
      </button>
    </div>
  );
}
