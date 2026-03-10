package security

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type TokenBucketLimiter struct {
	rdb          *redis.Client
	prefix       string
	capacity     int64
	refillRate   int64
	refillPeriod time.Duration
}

func NewTokenBucketLimiter(rdb *redis.Client, prefix string, capacity, refillRate int64, refillPeriod time.Duration) (*TokenBucketLimiter, error) {
	if rdb == nil {
		return nil, errors.New("redis client required")
	}
	if capacity <= 0 || refillRate <= 0 || refillPeriod <= 0 {
		return nil, errors.New("invalid rate limit configuration")
	}
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		prefix = "ratelimit:"
	}
	if !strings.HasSuffix(prefix, ":") {
		prefix += ":"
	}
	return &TokenBucketLimiter{
		rdb:          rdb,
		prefix:       prefix,
		capacity:     capacity,
		refillRate:   refillRate,
		refillPeriod: refillPeriod,
	}, nil
}

type RateLimitResult struct {
	Allowed     bool
	Remaining   int64
	ResetAtUnix int64
}

func (l *TokenBucketLimiter) Allow(ctx context.Context, key string) (RateLimitResult, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return RateLimitResult{Allowed: false}, errors.New("rate limit key required")
	}
	if len(key) > 200 || strings.ContainsAny(key, "\r\n\t ") {
		return RateLimitResult{Allowed: false}, errors.New("invalid rate limit key")
	}
	k := l.prefix + key
	nowMs := time.Now().UnixMilli()
	periodMs := l.refillPeriod.Milliseconds()

	if ctx == nil {
		ctx = context.Background()
	}
	if _, ok := ctx.Deadline(); !ok {
		c, cancel := context.WithTimeout(ctx, 250*time.Millisecond)
		defer cancel()
		ctx = c
	}

	res, err := l.rdb.Eval(ctx, tokenBucketLua(), []string{k},
		strconv.FormatInt(nowMs, 10),
		strconv.FormatInt(l.capacity, 10),
		strconv.FormatInt(l.refillRate, 10),
		strconv.FormatInt(periodMs, 10),
	).Result()
	if err != nil {
		return RateLimitResult{Allowed: false}, err
	}

	arr, ok := res.([]any)
	if !ok || len(arr) != 3 {
		return RateLimitResult{Allowed: false}, errors.New("invalid rate limit response")
	}

	allowed, _ := arr[0].(int64)
	remaining, _ := arr[1].(int64)
	resetAtMs, _ := arr[2].(int64)
	resetAtUnix := resetAtMs / 1000
	if resetAtUnix <= 0 {
		resetAtUnix = time.Now().Unix() + int64(l.refillPeriod.Seconds())
	}

	return RateLimitResult{
		Allowed:     allowed == 1,
		Remaining:   remaining,
		ResetAtUnix: resetAtUnix,
	}, nil
}

func tokenBucketLua() string {
	return `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])
local periodMs = tonumber(ARGV[4])

local bucket = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])

if tokens == nil then tokens = capacity end
if ts == nil then ts = now end

if now < ts then ts = now end

local delta = now - ts
local refill = math.floor(delta * refillRate / periodMs)
if refill > 0 then
  tokens = math.min(capacity, tokens + refill)
  ts = now
end

local allowed = 0
if tokens > 0 then
  allowed = 1
  tokens = tokens - 1
end

redis.call("HMSET", key, "tokens", tokens, "ts", ts)
redis.call("PEXPIRE", key, periodMs * 2)

local resetAt = ts + periodMs
return {allowed, tokens, resetAt}
`
}
