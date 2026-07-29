/**
 * Shared TypeScript types for the SafeScholar AI Gateway integration.
 *
 * Every external AI / scraping / translation call flows through our gateway
 * proxy layer. These types define the contract between client-side hooks,
 * server-side API routes, and the upstream provider SDKs.
 */

// ---------------------------------------------------------------------------
// Provider identifiers
// ---------------------------------------------------------------------------

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'cohere';
export type ScrapeProvider = 'firecrawl' | 'jina' | 'scraperapi';
export type TranslateProvider = 'deepl' | 'google' | 'libretranslate';

// ---------------------------------------------------------------------------
// Generic gateway envelope
// ---------------------------------------------------------------------------

/** Wraps every successful gateway response. */
export interface GatewaySuccess<T> {
  ok: true;
  data: T;
  meta: GatewayMeta;
}

/** Wraps every failed gateway response. */
export interface GatewayError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: GatewayMeta;
}

export type GatewayResponse<T> = GatewaySuccess<T> | GatewayError;

export interface GatewayMeta {
  requestId: string;
  provider: string;
  model?: string;
  latencyMs: number;
  tokensUsed?: number;
  cached: boolean;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Lesson Planner
// ---------------------------------------------------------------------------

export interface LessonPlanRequest {
  topic: string;
  gradeLevel: 'K-2' | '3-5' | '6-8' | '9-12' | 'higher-ed';
  durationMinutes: number;
  objectives?: string[];
  standards?: string[];
  language?: string;
}

export interface LessonPlanResponse {
  title: string;
  summary: string;
  objectives: string[];
  materials: string[];
  activities: LessonPlanActivity[];
  assessment: string;
  differentiation: string[];
}

export interface LessonPlanActivity {
  name: string;
  durationMinutes: number;
  description: string;
  type: 'direct-instruction' | 'group-work' | 'individual' | 'discussion' | 'hands-on';
}

// ---------------------------------------------------------------------------
// Quiz Generator
// ---------------------------------------------------------------------------

export type QuizQuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'fill-in-the-blank';

export interface QuizRequest {
  topic: string;
  sourceText?: string;
  numQuestions: number;
  questionTypes: QuizQuestionType[];
  difficulty: 'easy' | 'medium' | 'hard';
  language?: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizResponse {
  title: string;
  questions: QuizQuestion[];
}

// ---------------------------------------------------------------------------
// Flashcard Generator
// ---------------------------------------------------------------------------

export interface FlashcardRequest {
  topic: string;
  sourceText?: string;
  numCards: number;
  format: 'term-definition' | 'question-answer' | 'concept-example';
  language?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
}

export interface FlashcardResponse {
  deckTitle: string;
  cards: Flashcard[];
}

// ---------------------------------------------------------------------------
// Web Scrape
// ---------------------------------------------------------------------------

export interface ScrapeRequest {
  url: string;
  format: 'markdown' | 'html' | 'text';
  maxTokens?: number;
}

export interface ScrapeResponse {
  url: string;
  title: string;
  content: string;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Translate
// ---------------------------------------------------------------------------

export interface TranslateRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
}

export interface TranslateResponse {
  translatedText: string;
  detectedSourceLang?: string;
}

// ---------------------------------------------------------------------------
// Socratic Chat
// ---------------------------------------------------------------------------

export type SocraticSubject =
  | 'mathematics'
  | 'science'
  | 'history'
  | 'literature'
  | 'computer-science'
  | 'languages'
  | 'social-studies'
  | 'arts'
  | 'general';

export interface SocraticChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface SocraticChatRequest {
  message: string;
  history: SocraticChatMessage[];
  subject?: SocraticSubject;
  gradeLevel?: string;
}

export interface SocraticChatResponse {
  reply: string;
  flagged: boolean;
  warning?: string;
}

// ---------------------------------------------------------------------------
// Rate-limit & quota
// ---------------------------------------------------------------------------

export interface RateLimitInfo {
  remaining: number;
  resetAt: string;
  limit: number;
}
