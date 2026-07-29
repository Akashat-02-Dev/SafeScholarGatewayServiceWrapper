/**
 * Rate limiter — token-bucket per user, backed by Upstash Redis.
 *
 * Falls back to an in-memory Map when REDIS_URL is not set (dev only).
 */

type Bucket = { tokens: number; resetAt: number };

const LIMITS = {
  free: { requests: 20, windowSec: 3600 },   // 20 req / hour
  pro: { requests: 200, windowSec: 3600 },   // 200 req / hour
  admin: { requests: 1000, windowSec: 3600 },
} as const;

const memoryStore = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  limit: number;
}

export async function checkRateLimit(
  userId: string,
  tier: keyof typeof LIMITS = 'free',
): Promise<RateLimitResult> {
  const limit = LIMITS[tier];
  const now = Date.now();
  const key = `${userId}:${tier}`;
  const windowMs = limit.windowSec * 1000;

  // ---- In-memory fallback (dev) ------------------------------------------
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    let bucket = memoryStore.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { tokens: limit.requests, resetAt: now + windowMs };
    }
    if (bucket.tokens <= 0) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(bucket.resetAt).toISOString(),
        limit: limit.requests,
      };
    }
    bucket.tokens -= 1;
    memoryStore.set(key, bucket);
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetAt: new Date(bucket.resetAt).toISOString(),
      limit: limit.requests,
    };
  }

  // ---- Upstash Redis (prod) ----------------------------------------------
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;

  // Atomic sliding-window using Redis sorted sets (simplified token-bucket here)
  const scriptRes = await fetch(`${redisUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}` },
    body: JSON.stringify([
      ['ZREMRANGEBYSCORE', key, 0, now - windowMs],
      ['ZADD', key, { score: now, member: `${now}:${Math.random()}` }],
      ['ZCARD', key],
      ['PEXPIRE', key, windowMs],
    ]),
  });

  const data = await scriptRes.json();
  const count: number = data[2]?.result ?? 0;

  return {
    allowed: count <= limit.requests,
    remaining: Math.max(0, limit.requests - count),
    resetAt: new Date(now + windowMs).toISOString(),
    limit: limit.requests,
  };
}
