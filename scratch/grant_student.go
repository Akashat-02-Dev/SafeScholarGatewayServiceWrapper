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

	// Get role_id of student
	var roleID string
	err = dbpool.QueryRow(ctx, "SELECT role_id FROM roles WHERE name = 'student'").Scan(&roleID)
	if err != nil {
		log.Fatal(err)
	}

	// Get user_id of demo@student
	var userID string
	err = dbpool.QueryRow(ctx, "SELECT user_id FROM users WHERE email = 'demo@student'").Scan(&userID)
	if err != nil {
		log.Fatal(err)
	}

	// Insert into user_roles
	_, err = dbpool.Exec(ctx, "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", userID, roleID)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Added student role to demo@student.")
}
