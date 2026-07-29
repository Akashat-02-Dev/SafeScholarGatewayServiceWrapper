'use client';

import { useState } from 'react';

import { useLessonPlanner } from '@/hooks/useGateway';
import type { LessonPlanResponse } from '@/lib/types/gateway';

/**
 * Example dashboard component showing how to use the gateway hooks.
 * This is a minimal reference implementation — wire into your existing
 * SafeScholar UI as needed.
 */
export default function LessonPlannerPanel() {
  const [topic, setTopic] = useState('');
  const { data, loading, error, execute } = useLessonPlanner();

  const handleGenerate = () => {
    if (!topic.trim()) return;
    execute({
      topic,
      gradeLevel: '9-12',
      durationMinutes: 45,
      language: 'en',
    });
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h2>AI Lesson Planner</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Enter lesson topic…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 6, background: '#fef2f2', color: '#dc2626', marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {data && <LessonPlanCard plan={data} />}
    </div>
  );
}

function LessonPlanCard({ plan }: { plan: LessonPlanResponse }) {
  return (
    <div style={{ padding: 20, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}>
      <h3>{plan.title}</h3>
      <p style={{ color: '#6b7280' }}>{plan.summary}</p>

      {plan.objectives.length > 0 && (
        <>
          <h4>Objectives</h4>
          <ul>{plan.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </>
      )}

      {plan.activities.length > 0 && (
        <>
          <h4>Activities</h4>
          {plan.activities.map((a, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong>{a.name}</strong> <span style={{ color: '#9ca3af' }}>({a.durationMinutes} min)</span>
              <p>{a.description}</p>
            </div>
          ))}
        </>
      )}

      <h4>Assessment</h4>
      <p>{plan.assessment}</p>
    </div>
  );
}
