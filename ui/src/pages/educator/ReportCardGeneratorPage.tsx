import React, { useState } from 'react';
import { BookOpen, AlertCircle, FileText } from 'lucide-react';
import { LMSExportButton } from '../../components/LMSExportButton';
import { useAuth } from '../../services/authService';

export default function ReportCardGeneratorPage() {
  const { tokens, me } = useAuth();
  const [studentName, setStudentName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('C');
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        throw new Error('User is not authenticated. Please log in again.');
      }

      const response = await fetch('/api/v1/ai/educator/report-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          tool_id: 'report_card_generator',
          institution_id: me?.institutionId || '',
          parameters: {
            student_name: studentName,
            subject: subject,
            grade_assigned: grade,
            user_prompt: notes
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || 'Failed to generate report card comment');
      }

      const data = await response.json();
      const parsedContent = typeof data.response_text === 'string' ? JSON.parse(data.response_text) : data.response_text;
      setResult(parsedContent);
    } catch (err: any) {
      setError(err.message || 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };


  const generateHtml = () => {
    if (!result) return "";
    return `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Report Card: ${result.student_name}</h2>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Grade Assigned:</strong> ${result.grade_assigned}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #334155; line-height: 1.6;">${result.report_comment}</p>
      </div>
    `;
  };

  return (
    <div className="pt-24 pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-emerald-500" />
          Australian Report Card Generator
        </h1>
        <p className="text-slate-600 mt-2 text-lg">
          Generate QCAA A-E graded pastoral report card comments.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Student Name</label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="e.g. Alex"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="e.g. Year 10 Mathematics"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grade (A-E)</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="A">A - Exemplary</option>
                <option value="B">B - Highly Proficient</option>
                <option value="C">C - Proficient</option>
                <option value="D">D - Developing</option>
                <option value="E">E - Novice</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Feedback Notes</label>
              <textarea
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 h-32 resize-none"
                placeholder="List key achievements, areas for improvement, and general classroom behavior..."
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Synthesizing Comment...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Generate Report Card
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-6 flex flex-col h-full">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-center font-medium">Generated report card comment will appear here</p>
            </div>
          ) : (
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Student</h3>
                <p className="text-lg font-medium text-slate-900">{result.student_name}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Grade Assigned</h3>
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                  {result.grade_assigned}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Official Comment</h3>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {result.report_comment}
                  </p>
                </div>
              </div>
              
              <LMSExportButton contentHtml={generateHtml()} courseId="QCAA-Course" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
