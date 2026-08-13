package main

import (
	"context"
	"fmt"
	"os"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/security"
)

func main() {
	ctx := context.Background()
	os.Setenv("CONFIG_PATH", "d:\\Project\\SafeScholarGatewayWrapper\\SafeScholarGatewayServiceWrapper\\config\\config.dev.yaml")
	os.Setenv("APP_ENV", "dev")
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Load config: %v\n", err)
		return
	}
	pool, err := database.Connect(ctx, cfg.Postgres)
	if err != nil {
		fmt.Printf("Connect: %v\n", err)
		return
	}
	defer pool.Close()

	hash, err := security.HashPassword("password123", security.DefaultArgon2idParams)
	if err != nil {
		fmt.Printf("Hash: %v\n", err)
		return
	}
	
	_, err = pool.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE email = 'demo@student'", hash)
	if err != nil {
		fmt.Printf("Update: %v\n", err)
		return
	}
	fmt.Println("Password updated successfully to password123")
}
