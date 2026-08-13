package main

import (
	"context"
	"fmt"
	"safescholar/gateway/config"
	"github.com/redis/go-redis/v9"
	"os"
)

func main() {
	os.Setenv("CONFIG_PATH", "d:\\Project\\SafeScholarGatewayWrapper\\SafeScholarGatewayServiceWrapper\\config\\config.dev.yaml")
	os.Setenv("APP_ENV", "dev")
	cfg, _ := config.Load()

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Address,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	
	rdb.FlushAll(context.Background())
	fmt.Println("Flushed Redis")
}
