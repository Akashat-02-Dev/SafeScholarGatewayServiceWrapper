/**
 * Prompt builders — construct system + user prompts for each AI task.
 *
 * Centralising prompts here makes them easy to version, A/B test, and audit.
 */

import type {
  FlashcardRequest,
  LessonPlanRequest,
  QuizRequest,
} from '../types/gateway';

// ---------------------------------------------------------------------------
// Lesson Planner
// ---------------------------------------------------------------------------

export function buildLessonPlanPrompt(req: LessonPlanRequest) {
  const system = `You are SafeScholar's expert curriculum designer. You create engaging, standards-aligned lesson plans for educators. Always respond in valid JSON matching the requested schema. Do not include markdown fences.`;

  const user = `Create a lesson plan with these requirements:
- Topic: ${req.topic}
- Grade level: ${req.gradeLevel}
- Duration: ${req.durationMinutes} minutes
${req.objectives?.length ? `- Learning objectives: ${req.objectives.join(', ')}` : ''}
${req.standards?.length ? `- Standards: ${req.standards.join(', ')}` : ''}
${req.language ? `- Output language: ${req.language}` : ''}

Return JSON with this exact shape:
{
  "title": string,
  "summary": string,
  "objectives": string[],
  "materials": string[],
  "activities": [{ "name": string, "durationMinutes": number, "description": string, "type": "direct-instruction" | "group-work" | "individual" | "discussion" | "hands-on" }],
  "assessment": string,
  "differentiation": string[]
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Quiz Generator
// ---------------------------------------------------------------------------

export function buildQuizPrompt(req: QuizRequest) {
  const system = `You are SafeScholar's quiz generator. You create pedagogically sound quiz questions. Always respond in valid JSON matching the requested schema. Do not include markdown fences.`;

  const user = `Generate a quiz:
- Topic: ${req.topic}
- Number of questions: ${req.numQuestions}
- Question types: ${req.questionTypes.join(', ')}
- Difficulty: ${req.difficulty}
${req.sourceText ? `- Base questions on this source material:\n${req.sourceText.slice(0, 8000)}` : ''}
${req.language ? `- Output language: ${req.language}` : ''}

Return JSON:
{
  "title": string,
  "questions": [{
    "id": string,
    "type": "multiple-choice" | "true-false" | "short-answer" | "fill-in-the-blank",
    "question": string,
    "options": string[] | null,
    "correctAnswer": string,
    "explanation": string,
    "difficulty": "easy" | "medium" | "hard"
  }]
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Flashcard Generator
// ---------------------------------------------------------------------------

export function buildFlashcardPrompt(req: FlashcardRequest) {
  const system = `You are SafeScholar's flashcard creator. You produce concise, accurate study cards. Always respond in valid JSON matching the requested schema. Do not include markdown fences.`;

  const user = `Generate flashcards:
- Topic: ${req.topic}
- Number of cards: ${req.numCards}
- Format: ${req.format}
${req.sourceText ? `- Source material:\n${req.sourceText.slice(0, 8000)}` : ''}
${req.language ? `- Output language: ${req.language}` : ''}

Return JSON:
{
  "deckTitle": string,
  "cards": [{
    "id": string,
    "front": string,
    "back": string,
    "tags": string[]
  }]
}`;

  return { system, user };
}
