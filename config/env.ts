/**
 * Centralised environment variable template.
 *
 * Copy this file to `.env.local` and fill in your keys.
 * NEVER commit `.env.local` — it's already in .gitignore.
 */

// ---------------------------------------------------------------------------
// AI Providers (at least one required)
// ---------------------------------------------------------------------------

// OpenAI
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Anthropic
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Google Gemini
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// ---------------------------------------------------------------------------
// Provider routing (optional — defaults shown)
// ---------------------------------------------------------------------------

export const AI_LESSON_PROVIDER   = process.env.AI_LESSON_PROVIDER   || 'openai';
export const AI_LESSON_MODEL      = process.env.AI_LESSON_MODEL      || 'gpt-4o';
export const AI_QUIZ_PROVIDER     = process.env.AI_QUIZ_PROVIDER     || 'openai';
export const AI_QUIZ_MODEL        = process.env.AI_QUIZ_MODEL        || 'gpt-4o-mini';
export const AI_FLASHCARD_PROVIDER = process.env.AI_FLASHCARD_PROVIDER || 'openai';
export const AI_FLASHCARD_MODEL    = process.env.AI_FLASHCARD_MODEL   || 'gpt-4o-mini';

// ---------------------------------------------------------------------------
// Scrape providers
// ---------------------------------------------------------------------------

export const SCRAPE_PROVIDER    = process.env.SCRAPE_PROVIDER    || 'firecrawl';
export const FIRECRAWL_API_KEY  = process.env.FIRECRAWL_API_KEY  || '';
export const JINA_API_KEY       = process.env.JINA_API_KEY       || '';
export const SCRAPERAPI_API_KEY = process.env.SCRAPERAPI_API_KEY || '';

// ---------------------------------------------------------------------------
// Translate providers
// ---------------------------------------------------------------------------

export const TRANSLATE_PROVIDER = process.env.TRANSLATE_PROVIDER || 'deepl';
export const DEEPL_API_KEY      = process.env.DEEPL_API_KEY      || '';
export const GOOGLE_API_KEY     = process.env.GOOGLE_API_KEY     || '';
export const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || '';

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export const UPSTASH_REDIS_REST_URL   = process.env.UPSTASH_REDIS_REST_URL   || '';
export const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

// NextAuth
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || '';
export const NEXTAUTH_URL    = process.env.NEXTAUTH_URL    || 'http://localhost:3000';
