/**
 * Provider router — decides which upstream provider + model to call based on
 * task type, user tier, and feature flags.
 *
 * Keeping this logic server-side means we can swap providers (e.g. move from
 * OpenAI to Anthropic) without touching client code.
 */

import type {
  AIProvider,
  ScrapeProvider,
  TranslateProvider,
} from '../types/gateway';

type UserTier = 'free' | 'pro' | 'admin';

interface ProviderConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
}

// ---------------------------------------------------------------------------
// Provider selection tables
// ---------------------------------------------------------------------------

const AI_MODELS: Record<string, ProviderConfig> = {
  'lesson-planner': {
    provider: (process.env.AI_LESSON_PROVIDER as AIProvider) || 'openai',
    model: process.env.AI_LESSON_MODEL || 'gpt-4o',
    maxTokens: 4096,
  },
  'quiz-generator': {
    provider: (process.env.AI_QUIZ_PROVIDER as AIProvider) || 'openai',
    model: process.env.AI_QUIZ_MODEL || 'gpt-4o-mini',
    maxTokens: 4096,
  },
  flashcard: {
    provider: (process.env.AI_FLASHCARD_PROVIDER as AIProvider) || 'openai',
    model: process.env.AI_FLASHCARD_MODEL || 'gpt-4o-mini',
    maxTokens: 2048,
  },
};

const SCRAPE_PROVIDER: ScrapeProvider =
  (process.env.SCRAPE_PROVIDER as ScrapeProvider) || 'firecrawl';

const TRANSLATE_PROVIDER: TranslateProvider =
  (process.env.TRANSLATE_PROVIDER as TranslateProvider) || 'deepl';

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function getAIConfig(task: keyof typeof AI_MODELS, _tier: UserTier = 'free'): ProviderConfig {
  return AI_MODELS[task];
}

export function getScrapeProvider(): ScrapeProvider {
  return SCRAPE_PROVIDER;
}

export function getTranslateProvider(): TranslateProvider {
  return TRANSLATE_PROVIDER;
}

/**
 * Returns the API key for the given provider from environment variables.
 * Throws if the key is missing — the caller should catch and return a
 * typed GatewayError.
 */
export function getProviderApiKey(provider: string): string {
  const key = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (!key) {
    throw new Error(`Missing API key for provider "${provider}". Set ${provider.toUpperCase()}_API_KEY in .env.local`);
  }
  return key;
}
