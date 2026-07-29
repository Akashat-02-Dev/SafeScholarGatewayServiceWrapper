/**
 * Input validation utilities for gateway endpoints.
 *
 * Uses simple runtime type guards rather than pulling in zod — keeps the
 * dependency footprint small. Swap to zod if schemas grow complex.
 */

function isString(v: unknown, maxLen = 10000): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= maxLen;
}

function isNum(v: unknown, min = 1, max = 100): v is number {
  return typeof v === 'number' && v >= min && v <= max;
}

export function validateLessonPlan(body: unknown): string | null {
  const b = body as Record<string, unknown>;
  if (!isString(b.topic, 500)) return 'topic is required (max 500 chars)';
  if (!['K-2', '3-5', '6-8', '9-12', 'higher-ed'].includes(b.gradeLevel as string))
    return 'gradeLevel is invalid';
  if (!isNum(b.durationMinutes, 5, 480)) return 'durationMinutes must be 5–480';
  return null;
}

export function validateQuiz(body: unknown): string | null {
  const b = body as Record<string, unknown>;
  if (!isString(b.topic, 500)) return 'topic is required';
  if (!isNum(b.numQuestions, 1, 50)) return 'numQuestions must be 1–50';
  if (!Array.isArray(b.questionTypes) || b.questionTypes.length === 0)
    return 'questionTypes must be a non-empty array';
  if (!['easy', 'medium', 'hard'].includes(b.difficulty as string))
    return 'difficulty is invalid';
  return null;
}

export function validateFlashcard(body: unknown): string | null {
  const b = body as Record<string, unknown>;
  if (!isString(b.topic, 500)) return 'topic is required';
  if (!isNum(b.numCards, 1, 100)) return 'numCards must be 1–100';
  return null;
}

export function validateScrape(body: unknown): string | null {
  const b = body as Record<string, unknown>;
  if (!isString(b.url, 2048)) return 'url is required';
  try {
    const u = new URL(b.url);
    if (!['http:', 'https:'].includes(u.protocol)) return 'url must be http/https';
  } catch {
    return 'url is malformed';
  }
  if (!['markdown', 'html', 'text'].includes(b.format as string))
    return 'format must be markdown | html | text';
  return null;
}

export function validateTranslate(body: unknown): string | null {
  const b = body as Record<string, unknown>;
  if (!isString(b.text, 50000)) return 'text is required (max 50k chars)';
  if (!isString(b.sourceLang, 10)) return 'sourceLang is required';
  if (!isString(b.targetLang, 10)) return 'targetLang is required';
  return null;
}
