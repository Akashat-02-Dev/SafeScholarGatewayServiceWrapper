/**
 * GatewayClient — the single entry point for all AI / scrape / translate calls.
 *
 * Client-side code never talks to external providers directly. Instead it calls
 * our own `/api/gateway/*` routes, which:
 *
 *   1. Validate the session (NextAuth).
 *   2. Check rate-limits per user.
 *   3. Inject API keys server-side (never exposed to the browser).
 *   4. Call the upstream provider SDK.
 *   5. Return a normalised {@link GatewayResponse} envelope.
 *
 * This file is safe to import in client components (`"use client"`).
 */

import type {
  FlashcardRequest,
  FlashcardResponse,
  GatewayResponse,
  LessonPlanRequest,
  LessonPlanResponse,
  QuizRequest,
  QuizResponse,
  ScrapeRequest,
  ScrapeResponse,
  SocraticChatRequest,
  SocraticChatResponse,
  TranslateRequest,
  TranslateResponse,
} from '../types/gateway';

const BASE = '/api/gateway';

async function post<TReq, TRes>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): Promise<GatewayResponse<TRes>> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  // Attempt to parse the envelope even on non-200 so callers get a typed error.
  const json = (await res.json().catch(() => null)) as GatewayResponse<TRes> | null;

  if (!json) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Gateway returned ${res.status} ${res.statusText}`,
      },
      meta: {
        requestId: 'unknown',
        provider: 'unknown',
        latencyMs: 0,
        cached: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return json;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const gatewayClient = {
  // ---- AI endpoints -------------------------------------------------------
  generateLessonPlan: (
    req: LessonPlanRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse<LessonPlanResponse>> =>
    post('/ai/lesson-planner', req, signal),

  generateQuiz: (
    req: QuizRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse<QuizResponse>> =>
    post('/ai/quiz-generator', req, signal),

  generateFlashcards: (
    req: FlashcardRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse<FlashcardResponse>> =>
    post('/ai/flashcard', req, signal),

  // ---- Socratic chat ------------------------------------------------------
  socraticChat: (
    req: SocraticChatRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse<SocraticChatResponse>> =>
    post('/ai/socratic-chat', req, signal),

  // ---- Utility endpoints --------------------------------------------------
  scrape: (
    req: ScrapeRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse<ScrapeResponse>> =>
    post('/scrape', req, signal),

  translate: (
    req: TranslateRequest,
    signal?: AbortSignal,
  ): Promise<GatewayResponse<TranslateResponse>> =>
    post('/translate', req, signal),
};

export { gatewayClient as default };
