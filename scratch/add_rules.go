package main

import (
	"context"
	"fmt"
	"os"
	"log"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/database"
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

	// Get institution ID
	var instID string
	err = dbpool.QueryRow(ctx, "SELECT institution_id FROM institutions LIMIT 1").Scan(&instID)
	if err != nil {
		log.Fatal(err)
	}

	// Create table
	_, err = dbpool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS tenant_moderation_rules (
			institution_id UUID PRIMARY KEY,
			blocked_keywords JSONB NOT NULL DEFAULT '[]',
			custom_blocked_message TEXT NOT NULL DEFAULT ''
		)
	`)
	if err != nil {
		log.Fatal(err)
	}

	// Insert rules
	keywords := `["harm", "kill", "suicide"]`
	_, err = dbpool.Exec(ctx, "INSERT INTO tenant_moderation_rules (institution_id, blocked_keywords, custom_blocked_message) VALUES ($1, $2, 'Blocked.') ON CONFLICT (institution_id) DO UPDATE SET blocked_keywords = EXCLUDED.blocked_keywords", instID, keywords)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Added moderation rules.")
}
