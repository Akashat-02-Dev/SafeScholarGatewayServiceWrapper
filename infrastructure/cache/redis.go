package cache

import (
	"context"
	"crypto/tls"
	"errors"
	"time"

	"safescholar/gateway/config"

	"github.com/redis/go-redis/v9"
)

func Connect(ctx context.Context, cfg config.RedisConfig) (*redis.Client, error) {
	if cfg.Addr == "" {
		return nil, errors.New("redis addr required")
	}

	var tlsCfg *tls.Config
	if cfg.UseTLS {
		tlsCfg = &tls.Config{
			MinVersion: tls.VersionTLS13,
		}
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Username:     cfg.Username,
		Password:     cfg.Password,
		DB:           cfg.DB,
		DialTimeout:  cfg.DialTimeout,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		TLSConfig:    tlsCfg,
	})

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		return nil, err
	}

	return rdb, nil
}
