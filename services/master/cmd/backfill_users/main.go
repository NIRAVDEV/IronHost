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
		log.Printf("Warning: Could not read .env: %v", err)
	} else {
		lines := strings.Split(string(envContent), "\n")
		for _, line := range lines {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				os.Setenv(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
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

	fmt.Println("Connected to DB.")

	// 3. Backfill Users
	// We copy from auth.users to public.users
	// We need to handle potential NULLs for username
	query := `
		INSERT INTO public.users (id, email, username, password_hash)
		SELECT 
			id, 
			email, 
			COALESCE(raw_user_meta_data->>'username', email, 'unknown_user'),
			'oauth-placeholder'
		FROM auth.users
		ON CONFLICT (id) DO NOTHING;
	`

	tag, err := conn.Exec(context.Background(), query)
	if err != nil {
		log.Fatalf("Backfill failed: %v", err)
	}

	fmt.Printf("✅ Backfill complete. Inserted/Ignored rows: %d\n", tag.RowsAffected())
}
