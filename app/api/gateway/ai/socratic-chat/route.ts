/**
 * Socratic Chat API Route — POST /api/gateway/ai/socratic-chat
 *
 * Full security pipeline (7 layers):
 *
 *   1. Authentication     — requireUser() checks NextAuth session
 *   2. Rate limiting       — checkRateLimit() enforces per-user quotas
 *   3. Input validation    — message present, history well-formed
 *   4. Content guardrail   — filterMessage() blocks PII, injection, off-topic
 *   5. History sanitiser   — sanitizeHistory() trims & re-filters prior turns
 *   6. Socratic system prompt — constrains LLM to tutor persona with hard boundaries
 *   7. Response sanitiser  — strips any leaked system-prompt fragments from output
 */

import { NextRequest, NextResponse } from 'next/server';

import { callLLM } from '@/lib/gateway/llmCallers';
import { getAIConfig, getProviderApiKey } from '@/lib/gateway/providerRouter';
import { buildSocraticSystemPrompt, buildSocraticUserPrompt } from '@/lib/gateway/socraticPrompt';
import { ok, fail } from '@/lib/gateway/envelope';
import { requireUser } from '@/lib/security/requireUser';
import { checkRateLimit } from '@/lib/security/rateLimit';
import {
  filterMessage,
  sanitizeHistory,
  moderateWithLLM,
  MAX_MESSAGE_LENGTH,
} from '@/lib/security/contentFilter';
import type {
  SocraticChatRequest,
  SocraticChatResponse,
  SocraticChatMessage,
} from '@/lib/types/gateway';

export const runtime = 'nodejs';
export const maxDuration = 45;

// ---------------------------------------------------------------------------
// Constants for the Socratic task
// ---------------------------------------------------------------------------

const SOCRATIC_CONFIG = {
  task: 'socratic-chat' as const,
  defaultModel: 'gpt-4o-mini',
  maxTokens: 512,        // Keep responses concise
  temperature: 0.6,      // Deterministic enough for tutoring, creative enough for analogies
};

// ---------------------------------------------------------------------------
// Helper: validate the chat request body
// ---------------------------------------------------------------------------

function validateChatRequest(body: unknown): string | null {
  const b = body as Record<string, unknown>;

  if (typeof b.message !== 'string' || b.message.trim().length === 0) {
    return 'message is required and must be a non-empty string';
  }
  if (b.message.length > MAX_MESSAGE_LENGTH) {
    return `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`;
  }

  if (b.history !== undefined) {
    if (!Array.isArray(b.history)) return 'history must be an array';
    for (const msg of b.history) {
      if (typeof msg !== 'object' || msg === null) return 'history entries must be objects';
      const m = msg as Record<string, unknown>;
      if (m.role !== 'user' && m.role !== 'assistant') return 'history role must be user or assistant';
      if (typeof m.content !== 'string') return 'history content must be a string';
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helper: sanitise the LLM's output to prevent system-prompt leakage
// ---------------------------------------------------------------------------

const LEAKAGE_PATTERNS = [
  /you\s+are\s+.*safescholar.*identity/i,
  /system\s+prompt/i,
  /these\s+instructions/i,
  /your\s+rules/i,
  /I\s+am\s+programmed/i,
  /my\s+guidelines\s+are/i,
];

function sanitiseOutput(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences if the LLM wrapped its reply
  cleaned = cleaned.replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/i, '');

  // Check for system-prompt leakage
  for (const pattern of LEAKAGE_PATTERNS) {
    if (pattern.test(cleaned)) {
      return "I'm here to help you learn! What topic would you like to explore?";
    }
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Main route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body = await req.json().catch(() => null);

  // ===== Layer 1: Authentication =====
  const user = await requireUser(req as unknown as Parameters<typeof requireUser>[0]);
  if (!user) {
    return NextResponse.json(
      fail('UNAUTHORIZED', 'Authentication required. Please sign in to use the Socratic tutor.'),
      { status: 401 },
    );
  }

  // ===== Layer 2: Rate limiting =====
  const rl = await checkRateLimit(user.id, user.tier);
  if (!rl.allowed) {
    return NextResponse.json(
      fail('RATE_LIMITED', `You've reached your message limit. Resets at ${rl.resetAt}.`),
      { status: 429, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': rl.resetAt } },
    );
  }

  // ===== Layer 3: Input validation =====
  const validationError = validateChatRequest(body);
  if (validationError) {
    return NextResponse.json(fail('BAD_REQUEST', validationError), { status: 400 });
  }

  const reqData = body as SocraticChatRequest;

  // ===== Layer 4: Content guardrail =====
  const filterResult = filterMessage(reqData.message);

  if (filterResult.severity === 'block') {
    // Log the block reason server-side (do NOT expose detail to client)
    console.warn(`[GUARDRAIL BLOCK] user=${user.id} reason=${filterResult.reason}`);

    // Return a safe, generic message to the user
    const safeResponse: SocraticChatResponse = {
      reply: getSafeRefusalMessage(filterResult.reason),
      flagged: true,
      warning: 'Your message was blocked by the content filter. Please keep the conversation focused on your studies.',
    };

    return NextResponse.json(
      ok(safeResponse, {
        provider: 'guardrail',
        latencyMs: Date.now() - start,
      }),
    );
  }

  // Use the sanitised message going forward
  const safeMessage = filterResult.sanitized!;

  // ===== Layer 4b: Optional LLM moderation (if API key available) =====
  let moderationFlagged = false;
  try {
    const config = getAIConfig('lesson-planner', user.tier); // reuse OpenAI key for moderation
    const apiKey = getProviderApiKey(config.provider);
    if (config.provider === 'openai') {
      const moderation = await moderateWithLLM(safeMessage, apiKey);
      if (moderation.flagged) {
        moderationFlagged = true;
        console.warn(`[MODERATION BLOCK] user=${user.id} categories=${moderation.categories.join(',')}`);
      }
    }
  } catch {
    // If moderation key is missing, skip this layer (pattern filter already ran)
  }

  if (moderationFlagged) {
    const safeResponse: SocraticChatResponse = {
      reply: "I'm SafeScholar, your academic tutor. I can only help with study-related questions. What subject are you working on?",
      flagged: true,
      warning: 'Your message was flagged by the moderation system.',
    };
    return NextResponse.json(
      ok(safeResponse, {
        provider: 'moderation',
        latencyMs: Date.now() - start,
      }),
    );
  }

  // ===== Layer 5: History sanitiser =====
  const cleanHistory = sanitizeHistory(
    (reqData.history || []).map((m) => ({
      role: m.role,
      content: m.content,
    })) as SocraticChatMessage[],
  );

  // ===== Layer 6: Socratic system prompt + LLM call =====
  try {
    const config = getAIConfig('lesson-planner', user.tier);
    const apiKey = getProviderApiKey(config.provider);

    const systemPrompt = buildSocraticSystemPrompt(reqData.subject, reqData.gradeLevel);
    const userPrompt = buildSocraticUserPrompt(safeMessage);

    // Build the messages array for chat-style LLMs
    // For providers that accept message arrays (OpenAI, Anthropic), we pass
    // the history directly. For simplicity, we concatenate history into the
    // user prompt for all providers via the llmCallers wrapper.
    const historyContext = cleanHistory.length > 0
      ? cleanHistory.map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n') + '\n\n'
      : '';

    const fullUserPrompt = historyContext + userPrompt;

    const rawReply = await callLLM(config.provider, {
      apiKey,
      model: config.model,
      systemPrompt,
      userPrompt: fullUserPrompt,
      maxTokens: SOCRATIC_CONFIG.maxTokens,
      temperature: SOCRATIC_CONFIG.temperature,
      signal: req.signal,
    });

    // ===== Layer 7: Response sanitiser =====
    const cleanReply = sanitiseOutput(rawReply);

    const response: SocraticChatResponse = {
      reply: cleanReply,
      flagged: false,
    };

    return NextResponse.json(
      ok(response, {
        provider: config.provider,
        model: config.model,
        latencyMs: Date.now() - start,
      }),
    );
  } catch (err) {
    console.error(`[SOCRATIC ERROR] user=${user.id} error=${(err as Error).message}`);
    return NextResponse.json(
      fail('PROVIDER_ERROR', 'The AI tutor is temporarily unavailable. Please try again in a moment.', {
        latencyMs: Date.now() - start,
      }),
      { status: 502 },
    );
  }
}

// ---------------------------------------------------------------------------
// Safe refusal messages by category
// ---------------------------------------------------------------------------

function getSafeRefusalMessage(reason: string): string {
  if (reason.startsWith('PII_DETECTED')) {
    return "It looks like your message contains personal information. For your safety, please remove any phone numbers, emails, or addresses and try again.";
  }
  if (reason === 'PROMPT_INJECTION') {
    return "I'm SafeScholar, your academic tutor. I'm here to help you learn through guided questions. What subject are you studying?";
  }
  if (reason.startsWith('OFF_TOPIC:VIOLENCE') || reason.startsWith('OFF_TOPIC:WEAPONS')) {
    return "I'm not able to discuss that topic. I'm SafeScholar, an academic tutor — I can help you with subjects like math, science, history, and literature. What are you studying?";
  }
  if (reason.startsWith('OFF_TOPIC:SEXUAL')) {
    return "I'm SafeScholar, an educational tutor. I can only help with academic questions. What subject are you working on?";
  }
  if (reason.startsWith('OFF_TOPIC:ILLEGAL')) {
    return "I can't help with that. I'm here to support your learning. What academic topic can I help you explore today?";
  }
  if (reason.startsWith('OFF_TOPIC:HATE')) {
    return "I'm committed to maintaining a respectful learning environment. I can help you with academic subjects — what are you studying?";
  }
  if (reason.startsWith('OFF_TOPIC:MALICIOUS')) {
    return "I can't assist with that. I'm SafeScholar, focused on academic learning. What subject can I help you with?";
  }
  if (reason.startsWith('OFF_TOPIC:CHEATING')) {
    return "I can't complete your assignment for you — that wouldn't help you learn! But I'd love to help you understand the topic. What's the assignment about? Let's break it down together.";
  }
  if (reason === 'MESSAGE_TOO_LONG') {
    return "Your message is quite long! Could you summarise your question in a shorter way so I can help you better?";
  }
  if (reason === 'EMPTY_MESSAGE') {
    return "It looks like you sent an empty message. What would you like to learn about today?";
  }

  // Generic fallback
  return "I'm SafeScholar, your academic tutor. I can help with study-related questions. What subject are you working on?";
}
