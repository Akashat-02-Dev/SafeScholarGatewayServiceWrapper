package service_registry

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"sync"
	"time"

	"safescholar/gateway/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Registry struct {
	static map[string]string
	pool   *pgxpool.Pool

	mu    sync.RWMutex
	cache map[string]string
}

func New(cfg config.RegistryConfig, pool *pgxpool.Pool) *Registry {
	static := map[string]string{}
	for k, v := range cfg.Static {
		static[strings.ToLower(strings.TrimSpace(k))] = strings.TrimSpace(v)
	}
	return &Registry{
		static: static,
		pool:   pool,
		cache:  map[string]string{},
	}
}

func (r *Registry) Resolve(ctx context.Context, name string) (string, error) {
	n := strings.ToLower(strings.TrimSpace(name))
	if n == "" {
		return "", errors.New("service name required")
	}

	if v, ok := r.static[n]; ok && v != "" {
		if err := validateBaseURL(v); err != nil {
			return "", err
		}
		return v, nil
	}

	r.mu.RLock()
	if v, ok := r.cache[n]; ok && v != "" {
		r.mu.RUnlock()
		return v, nil
	}
	r.mu.RUnlock()

	if r.pool == nil {
		return "", errors.New("service not found")
	}

	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	var baseURL string
	if err := r.pool.QueryRow(ctx, `select endpoint from services where service_name=$1`, n).Scan(&baseURL); err != nil {
		return "", errors.New("service not found")
	}
	baseURL = strings.TrimSpace(baseURL)
	if err := validateBaseURL(baseURL); err != nil {
		return "", err
	}

	r.mu.Lock()
	r.cache[n] = baseURL
	r.mu.Unlock()

	return baseURL, nil
}

func validateBaseURL(s string) error {
	u, err := url.Parse(s)
	if err != nil {
		return errors.New("invalid service base url")
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return errors.New("invalid service base url scheme")
	}
	if u.Host == "" {
		return errors.New("invalid service base url host")
	}
	return nil
}
