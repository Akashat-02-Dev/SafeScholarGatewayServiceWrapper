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

	// Get role_id of sysadmin
	var roleID string
	err = dbpool.QueryRow(ctx, "SELECT role_id FROM roles WHERE name = 'sysadmin'").Scan(&roleID)
	if err != nil {
		log.Fatal(err)
	}

	// Get permission_id of MANAGE_USERS
	var permID string
	err = dbpool.QueryRow(ctx, "SELECT permission_id FROM permissions WHERE name = 'MANAGE_USERS'").Scan(&permID)
	if err != nil {
		log.Fatal(err)
	}

	// Insert into role_permissions
	_, err = dbpool.Exec(ctx, "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", roleID, permID)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Added MANAGE_USERS to sysadmin.")
}
