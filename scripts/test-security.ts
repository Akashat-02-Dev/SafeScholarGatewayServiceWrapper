/**
 * Security & validation test suite — runs without a server.
 *
 * Usage:  npx tsx scripts/test-security.ts
 */

import { validateLessonPlan, validateQuiz, validateFlashcard, validateScrape, validateTranslate } from '../lib/security/validate';
import { checkRateLimit } from '../lib/security/rateLimit';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ FAIL: ' + msg); }
}

async function main() {
  console.log('\n📋 Testing input validation...\n');

  // -- Lesson Plan --
  console.log('Lesson Planner:');
  assert(validateLessonPlan({}) !== null, 'Empty body rejected');
  assert(validateLessonPlan({ topic: 'x'.repeat(501), gradeLevel: '9-12', durationMinutes: 45 }) !== null, 'Oversized topic rejected');
  assert(validateLessonPlan({ topic: 'Photosynthesis', gradeLevel: '9-12', durationMinutes: 45 }) === null, 'Valid request accepted');
  assert(validateLessonPlan({ topic: 'Math', gradeLevel: 'invalid', durationMinutes: 45 }) !== null, 'Invalid grade level rejected');
  assert(validateLessonPlan({ topic: 'Math', gradeLevel: '9-12', durationMinutes: 1 }) !== null, 'Duration too short rejected');
  assert(validateLessonPlan({ topic: 'Math', gradeLevel: '9-12', durationMinutes: 500 }) !== null, 'Duration too long rejected');

  // -- Quiz --
  console.log('\nQuiz Generator:');
  assert(validateQuiz({ topic: 'Biology', numQuestions: 5, questionTypes: ['multiple-choice'], difficulty: 'medium' }) === null, 'Valid quiz accepted');
  assert(validateQuiz({ topic: 'Bio', numQuestions: 0, questionTypes: ['mc'], difficulty: 'medium' }) !== null, 'Zero questions rejected');
  assert(validateQuiz({ topic: 'Bio', numQuestions: 100, questionTypes: ['mc'], difficulty: 'medium' }) !== null, 'Too many questions rejected');
  assert(validateQuiz({ topic: 'Bio', numQuestions: 5, questionTypes: [], difficulty: 'medium' }) !== null, 'Empty question types rejected');

  // -- Flashcard --
  console.log('\nFlashcard Generator:');
  assert(validateFlashcard({ topic: 'History', numCards: 10, format: 'term-definition' }) === null, 'Valid flashcard accepted');
  assert(validateFlashcard({ topic: 'History', numCards: 0, format: 'term-definition' }) !== null, 'Zero cards rejected');

  // -- Scrape (SSRF protection) --
  console.log('\nScrape (SSRF protection):');
  assert(validateScrape({ url: 'javascript:alert(1)', format: 'text' }) !== null, 'javascript: protocol blocked');
  assert(validateScrape({ url: 'file:///etc/passwd', format: 'text' }) !== null, 'file:// protocol blocked');
  assert(validateScrape({ url: 'ftp://evil.com', format: 'text' }) !== null, 'ftp:// protocol blocked');
  assert(validateScrape({ url: 'not-a-url', format: 'text' }) !== null, 'Malformed URL rejected');
  assert(validateScrape({ url: 'https://example.com', format: 'text' }) === null, 'Valid https URL accepted');

  // -- Translate --
  console.log('\nTranslate:');
  assert(validateTranslate({ text: 'hello', sourceLang: 'en', targetLang: 'es' }) === null, 'Valid translate accepted');
  assert(validateTranslate({ text: '', sourceLang: 'en', targetLang: 'es' }) !== null, 'Empty text rejected');
  assert(validateTranslate({ text: 'x'.repeat(50001), sourceLang: 'en', targetLang: 'es' }) !== null, 'Oversized text rejected');

  // ---- Rate Limiter ----
  console.log('\n⏱️  Testing rate limiter (in-memory mode)...\n');
  const testUserId = 'test-user-' + Date.now();

  const results = [];
  for (let i = 0; i < 25; i++) {
    results.push(await checkRateLimit(testUserId, 'free'));
  }
  const allowed = results.filter(r => r.allowed).length;
  const blocked = results.filter(r => !r.allowed).length;

  assert(allowed === 20, 'Exactly 20 requests allowed (free tier)');
  assert(blocked === 5, '5 requests blocked after limit');
  assert(results[19].allowed === true, '20th request still allowed');
  assert(results[20].allowed === false, '21st request blocked');

  // Different user isolation
  const user2 = await checkRateLimit('different-user-' + Date.now(), 'free');
  assert(user2.allowed === true, 'Different user unaffected');

  // ---- Summary ----
  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('\n❌ Some tests failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All security tests passed!\n');
  }
}

main().catch(console.error);
