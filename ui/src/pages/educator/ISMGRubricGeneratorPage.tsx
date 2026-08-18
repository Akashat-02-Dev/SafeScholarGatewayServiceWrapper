import React, { useState } from 'react';
import { LayoutList, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { LMSExportButton } from '../../components/LMSExportButton';
import { useAuth } from '../../services/authService';

export default function ISMGRubricGeneratorPage() {
  const { tokens, me } = useAuth();
  const [subject, setSubject] = useState('');
  const [instrumentType, setInstrumentType] = useState('IA1');
  const [details, setDetails] = useState('');
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

      const response = await fetch('/api/v1/ai/educator/ismg-rubric', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          tool_id: 'ismg_rubric_generator',
          institution_id: me?.institutionId || '',
          parameters: {
            subject: subject,
            instrument_type: instrumentType,
            user_prompt: details
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || 'Failed to generate ISMG rubric');
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
    let criteriaHtml = "";
    result.ismg_criteria.forEach((c: any) => {
      criteriaHtml += `
        <h3 style="color: #0f172a; margin-top: 20px;">${c.criterion_name}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr>
              <th style="border: 1px solid #cbd5e1; padding: 10px; background: #f8fafc; text-align: left;">Mark Range</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; background: #f8fafc; text-align: left;">Description</th>
            </tr>
          </thead>
          <tbody>
      `;
      c.performance_levels.forEach((pl: any) => {
        criteriaHtml += `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 10px; width: 120px;"><strong>${pl.mark_range}</strong></td>
              <td style="border: 1px solid #cbd5e1; padding: 10px;">${pl.description}</td>
            </tr>
        `;
      });
      criteriaHtml += `
          </tbody>
        </table>
      `;
    });

    return `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #0f172a; margin-top: 0;">${result.assessment_title}</h2>
        <p style="color: #64748b; font-weight: bold;">Instrument: ${result.instrument_type}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        ${criteriaHtml}
      </div>
    `;
  };

  return (
    <div className="pt-24 pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <LayoutList className="w-8 h-8 text-indigo-500" />
          QCAA ISMG Rubric Generator
        </h1>
        <p className="text-slate-600 mt-2 text-lg">
          Generate strict Instrument-Specific Marking Guides aligned with cognitive verbs.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 h-fit">
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="e.g. Senior Biology"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instrument Type</label>
              <select
                value={instrumentType}
                onChange={(e) => setInstrumentType(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="IA1">IA1 (Data Test)</option>
                <option value="IA2">IA2 (Student Experiment)</option>
                <option value="IA3">IA3 (Research Investigation)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assessment Details</label>
              <textarea
                required
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-32 resize-none"
                placeholder="Describe the assessment task context and required cognitive verbs..."
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
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-2 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating ISMG...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Generate ISMG Rubric
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 flex flex-col min-h-[600px]">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <LayoutList className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-center font-medium">Generated ISMG rubric will appear here</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3 text-emerald-600 mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-semibold text-lg">QCAA ISMG Generation Complete</span>
                </div>
                
                <h2 className="text-2xl font-bold text-slate-900">{result.assessment_title}</h2>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                  {result.instrument_type}
                </div>
              </div>

              <div className="space-y-8 flex-1">
                {result.ismg_criteria.map((criterion: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </span>
                      {criterion.criterion_name}
                    </h3>
                    
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-3 px-4 font-semibold text-slate-700 w-32 border-r border-slate-200">Marks</th>
                            <th className="py-3 px-4 font-semibold text-slate-700">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {criterion.performance_levels.map((level: any, lIdx: number) => (
                            <tr key={lIdx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-slate-900 border-r border-slate-200 align-top">
                                {level.mark_range}
                              </td>
                              <td className="py-3 px-4 text-slate-700 leading-relaxed">
                                {level.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              <LMSExportButton contentHtml={generateHtml()} courseId="QCAA-Senior-Syllabus" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
