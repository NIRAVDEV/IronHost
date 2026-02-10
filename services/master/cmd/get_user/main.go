package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
)

func main() {
	// 1. Load .env file
	envPath := ".env"
	envContent, err := os.ReadFile(envPath)
	if err != nil {
		log.Printf("Warning: Could not read .env at %s: %v", envPath, err)
	} else {
		lines := strings.Split(string(envContent), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				value := strings.TrimSpace(parts[1])
				os.Setenv(key, value)
			}
		}
	}

	// 2. Connect to Database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	conn, err := pgx.Connect(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer conn.Close(context.Background())

	fmt.Println("Successfully connected to database.")

	// 3. Get First User
	var userID string
	var email string
	err = conn.QueryRow(context.Background(), "SELECT id, email FROM users LIMIT 1").Scan(&userID, &email)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Fatal("No users found in database! Please sign up manually via Supabase (or wait for sync).")
		}
		log.Fatalf("Failed to query users: %v", err)
	}

	fmt.Printf("\n✅ Found User:\n")
	fmt.Printf("   ID:    %s\n", userID)
	fmt.Printf("   Email: %s\n", email)
}
