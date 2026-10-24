package cache

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheService provides an enterprise-grade Cache-Aside layer with fail-open resilience.
type CacheService struct {
	rdb        *redis.Client
	enabled    bool
	defaultTTL time.Duration
	prefix     string
	logger     *slog.Logger
}

type CachedUser struct {
	UserID        string   `json:"user_id"`
	InstitutionID string   `json:"institution_id"`
	Email         string   `json:"email"`
	FirstName     string   `json:"first_name"`
	LastName      string   `json:"last_name"`
	Status        string   `json:"status"`
	IsSysAdmin    bool     `json:"is_sys_admin"`
	Roles         []string `json:"roles,omitempty"`
	Permissions   []string `json:"permissions,omitempty"`
}

type CachedInstitution struct {
	InstitutionID string `json:"institution_id"`
	Name          string `json:"name"`
	Domain        string `json:"domain"`
	Status        string `json:"status"`
}

func NewCacheService(rdb *redis.Client, enabled bool, defaultTTL time.Duration, prefix string, logger *slog.Logger) *CacheService {
	if defaultTTL <= 0 {
		defaultTTL = 10 * time.Minute
	}
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		prefix = "safescholar:cache:"
	}
	if !strings.HasSuffix(prefix, ":") {
		prefix += ":"
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &CacheService{
		rdb:        rdb,
		enabled:    enabled && rdb != nil,
		defaultTTL: defaultTTL,
		prefix:     prefix,
		logger:     logger,
	}
}

func (c *CacheService) IsEnabled() bool {
	return c != nil && c.enabled && c.rdb != nil
}

// Get fetches and deserializes a cached value into dest.
// Returns (true, nil) on cache hit, (false, nil) on cache miss.
// If Redis errors or times out, it fails open by returning (false, nil) so DB queries proceed.
func (c *CacheService) Get(ctx context.Context, key string, dest any) (bool, error) {
	if !c.IsEnabled() || strings.TrimSpace(key) == "" {
		return false, nil
	}

	fullKey := c.prefix + key
	cCtx, cancel := context.WithTimeout(ctx, 250*time.Millisecond)
	defer cancel()

	val, err := c.rdb.Get(cCtx, fullKey).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil // Cache miss
	}
	if err != nil {
		c.logger.Debug("cache get fail-open fallback", "key", key, "error", err)
		return false, nil // Fail-open resilience: proceed to DB
	}

	if err := json.Unmarshal([]byte(val), dest); err != nil {
		c.logger.Warn("cache unmarshal error, invalidating", "key", key, "error", err)
		_ = c.Delete(ctx, key)
		return false, nil
	}

	return true, nil
}

// Set serializes and stores a key-value pair with a TTL.
func (c *CacheService) Set(ctx context.Context, key string, val any, ttl time.Duration) error {
	if !c.IsEnabled() || strings.TrimSpace(key) == "" {
		return nil
	}
	if ttl <= 0 {
		ttl = c.defaultTTL
	}

	b, err := json.Marshal(val)
	if err != nil {
		return err
	}

	fullKey := c.prefix + key
	cCtx, cancel := context.WithTimeout(ctx, 250*time.Millisecond)
	defer cancel()

	return c.rdb.Set(cCtx, fullKey, b, ttl).Err()
}

// Delete removes one or more keys from the cache.
func (c *CacheService) Delete(ctx context.Context, keys ...string) error {
	if !c.IsEnabled() || len(keys) == 0 {
		return nil
	}

	fullKeys := make([]string, 0, len(keys))
	for _, k := range keys {
		trimmed := strings.TrimSpace(k)
		if trimmed != "" {
			fullKeys = append(fullKeys, c.prefix+trimmed)
		}
	}
	if len(fullKeys) == 0 {
		return nil
	}

	cCtx, cancel := context.WithTimeout(ctx, 250*time.Millisecond)
	defer cancel()

	return c.rdb.Del(cCtx, fullKeys...).Err()
}

// DeletePrefix invalidates all keys matching a prefix.
func (c *CacheService) DeletePrefix(ctx context.Context, prefix string) error {
	if !c.IsEnabled() || strings.TrimSpace(prefix) == "" {
		return nil
	}

	cCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	pattern := c.prefix + strings.TrimSpace(prefix) + "*"
	iter := c.rdb.Scan(cCtx, 0, pattern, 100).Iterator()
	var keys []string
	for iter.Next(cCtx) {
		keys = append(keys, iter.Val())
		if len(keys) >= 200 {
			_ = c.rdb.Del(cCtx, keys...).Err()
			keys = keys[:0]
		}
	}
	if len(keys) > 0 {
		_ = c.rdb.Del(cCtx, keys...).Err()
	}
	return iter.Err()
}

// Specific entity caching helpers

func (c *CacheService) GetUser(ctx context.Context, userID string) (*CachedUser, bool) {
	if !c.IsEnabled() || strings.TrimSpace(userID) == "" {
		return nil, false
	}
	var u CachedUser
	hit, _ := c.Get(ctx, "user:"+userID, &u)
	if hit {
		return &u, true
	}
	return nil, false
}

func (c *CacheService) SetUser(ctx context.Context, userID string, u *CachedUser, ttl time.Duration) {
	if !c.IsEnabled() || strings.TrimSpace(userID) == "" || u == nil {
		return
	}
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	_ = c.Set(ctx, "user:"+userID, u, ttl)
}

func (c *CacheService) InvalidateUser(ctx context.Context, userID string) {
	if !c.IsEnabled() || strings.TrimSpace(userID) == "" {
		return
	}
	_ = c.Delete(ctx, "user:"+userID, "perms:"+userID)
}

func (c *CacheService) GetInstitution(ctx context.Context, institutionID string) (*CachedInstitution, bool) {
	if !c.IsEnabled() || strings.TrimSpace(institutionID) == "" {
		return nil, false
	}
	var inst CachedInstitution
	hit, _ := c.Get(ctx, "institution:"+institutionID, &inst)
	if hit {
		return &inst, true
	}
	return nil, false
}

func (c *CacheService) SetInstitution(ctx context.Context, institutionID string, inst *CachedInstitution, ttl time.Duration) {
	if !c.IsEnabled() || strings.TrimSpace(institutionID) == "" || inst == nil {
		return
	}
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	_ = c.Set(ctx, "institution:"+institutionID, inst, ttl)
}

func (c *CacheService) InvalidateInstitution(ctx context.Context, institutionID string) {
	if !c.IsEnabled() || strings.TrimSpace(institutionID) == "" {
		return
	}
	_ = c.Delete(ctx, "institution:"+institutionID)
	_ = c.DeletePrefix(ctx, "roles:"+institutionID)
}
