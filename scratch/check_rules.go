//go:build ignore

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

	var studentInstID string
	err = dbpool.QueryRow(ctx, "SELECT institution_id FROM users WHERE email = 'demo@student'").Scan(&studentInstID)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Student Inst ID: %s\n", studentInstID)

	var kwRaw string
	err = dbpool.QueryRow(ctx, "SELECT blocked_keywords FROM tenant_moderation_rules WHERE institution_id = $1", studentInstID).Scan(&kwRaw)
	if err != nil {
		fmt.Printf("Rules error: %v\n", err)
	} else {
		fmt.Printf("Rules keywords: %s\n", kwRaw)
	}
}
