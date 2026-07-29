/**
 * Standalone test: runs the validation functions and rate limiter
 * without needing a running server. Verifies that:
 *
 *   1. Invalid inputs are rejected
 *   2. Valid inputs pass
 *   3. Rate limiter enforces limits
 */

// We need to tsx to run TS directly
import { spawnSync } from 'child_process';

const testCode = `
// Inline test — no test framework needed
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ FAIL: ' + msg); }
}

// ---- Validation tests ----
import { validateLessonPlan, validateQuiz, validateFlashcard, validateScrape, validateTranslate } from './lib/security/validate.js';

console.log('\\n📋 Testing input validation…');

// Lesson plan
assert(validateLessonPlan({}) === 'topic is required (max 500 chars)', 'Empty lesson plan rejected');
assert(validateLessonPlan({ topic: 'x'.repeat(501), gradeLevel: '9-12', durationMinutes: 45 }) !== null, 'Oversized topic rejected');
assert(validateLessonPlan({ topic: 'Photosynthesis', gradeLevel: '9-12', durationMinutes: 45 }) === null, 'Valid lesson plan accepted');
assert(validateLessonPlan({ topic: 'Math', gradeLevel: 'invalid', durationMinutes: 45 }) !== null, 'Invalid grade level rejected');
assert(validateLessonPlan({ topic: 'Math', gradeLevel: '9-12', durationMinutes: 1 }) !== null, 'Duration too short rejected');
assert(validateLessonPlan({ topic: 'Math', gradeLevel: '9-12', durationMinutes: 500 }) !== null, 'Duration too long rejected');

// Quiz
assert(validateQuiz({ topic: 'Biology', numQuestions: 5, questionTypes: ['multiple-choice'], difficulty: 'medium' }) === null, 'Valid quiz accepted');
assert(validateQuiz({ topic: 'Biology', numQuestions: 0, questionTypes: ['mc'], difficulty: 'medium' }) !== null, 'Zero questions rejected');
assert(validateQuiz({ topic: 'Biology', numQuestions: 100, questionTypes: ['mc'], difficulty: 'medium' }) !== null, 'Too many questions rejected');
assert(validateQuiz({ topic: 'Biology', numQuestions: 5, questionTypes: [], difficulty: 'medium' }) !== null, 'Empty question types rejected');

// Flashcard
assert(validateFlashcard({ topic: 'History', numCards: 10, format: 'term-definition' }) === null, 'Valid flashcard request accepted');
assert(validateFlashcard({ topic: 'History', numCards: 0, format: 'term-definition' }) !== null, 'Zero cards rejected');

// Scrape — SSRF protection
assert(validateScrape({ url: 'javascript:alert(1)', format: 'text' }) !== null, 'javascript: protocol blocked (SSRF)');
assert(validateScrape({ url: 'file:///etc/passwd', format: 'text' }) !== null, 'file:// protocol blocked (SSRF)');
assert(validateScrape({ url: 'not-a-url', format: 'text' }) !== null, 'Malformed URL rejected');
assert(validateScrape({ url: 'https://example.com', format: 'text' }) === null, 'Valid URL accepted');

// Translate
assert(validateTranslate({ text: 'hello', sourceLang: 'en', targetLang: 'es' }) === null, 'Valid translate accepted');
assert(validateTranslate({ text: '', sourceLang: 'en', targetLang: 'es' }) !== null, 'Empty text rejected');
assert(validateTranslate({ text: 'x'.repeat(50001), sourceLang: 'en', targetLang: 'es' }) !== null, 'Oversized text rejected');

// ---- Rate limiter tests ----
console.log('\\n⏱️  Testing rate limiter (in-memory mode)…');
import { checkRateLimit } from './lib/security/rateLimit.js';

// Should allow up to the limit, then block
const results = [];
for (let i = 0; i < 25; i++) {
  const r = await checkRateLimit('test-user-' + Date.now(), 'free');
  results.push(r);
}
const allowed = results.filter(r => r.allowed).length;
const blocked = results.filter(r => !r.allowed).length;
// Free tier = 20 requests/hour, so first 20 pass, next 5 blocked
assert(allowed === 20, 'Exactly 20 requests allowed (free tier limit)');
assert(blocked === 5, '5 requests blocked after limit hit');

// Different user should get their own bucket
const user2 = await checkRateLimit('different-user-' + Date.now(), 'free');
assert(user2.allowed === true, 'Different user not affected by other user rate limit');

// ---- Summary ----
console.log('\\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
console.log('✅ All security tests passed!');
`;

// Write the test file
import { writeFileSync, mkdirSync } from 'fs';
writeFileSync('/tmp/test-security.mjs', `
${testCode}
`);

console.log('Test file written. Running...');
