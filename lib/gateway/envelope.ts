/**
 * Helper to build a standard {@link GatewayResponse} envelope inside route
 * handlers so every endpoint returns the same shape.
 */

import { randomUUID } from 'crypto';

import type { GatewayMeta, GatewayResponse } from '../types/gateway';

export function ok<T>(data: T, meta: Partial<GatewayMeta>): GatewayResponse<T> {
  return {
    ok: true,
    data,
    meta: {
      requestId: meta.requestId || randomUUID(),
      provider: meta.provider || 'unknown',
      model: meta.model,
      latencyMs: meta.latencyMs || 0,
      tokensUsed: meta.tokensUsed,
      cached: meta.cached || false,
      timestamp: new Date().toISOString(),
    },
  };
}

export function fail(
  code: string,
  message: string,
  meta: Partial<GatewayMeta> = {},
  details?: unknown,
): GatewayResponse<never> {
  return {
    ok: false,
    error: { code, message, details },
    meta: {
      requestId: meta.requestId || randomUUID(),
      provider: meta.provider || 'unknown',
      latencyMs: meta.latencyMs || 0,
      cached: false,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Safely parse an LLM text response that *should* be JSON.
 * Strips markdown fences if present.
 */
export function parseLLMJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned) as T;
}
