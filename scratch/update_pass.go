package main

import (
	"context"
	"fmt"
	"os"
	"log"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/database"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	ctx := context.Background()
	os.Setenv("CONFIG_PATH", "d:\\Project\\SafeScholarGatewayWrapper\\SafeScholarGatewayServiceWrapper\\config\\config.dev.yaml")
	os.Setenv("APP_ENV", "dev")
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Load config: %v", err)
	}
	dbpool, err := database.Connect(ctx, cfg.Postgres)
	if err != nil {
		log.Fatalf("Connect: %v", err)
	}
	defer dbpool.Close()

	hash, err := bcrypt.GenerateFromPassword([]byte("Password123!"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}

	cmdTag, err := dbpool.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE email IN ('demo@localhost', 'demo@institute', 'demo@student')", string(hash))
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Updated %d rows.\n", cmdTag.RowsAffected())
}
