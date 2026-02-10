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

	// 3. Node Details
	nodeName := "Local PC"
	fqdn := "0.tcp.in.ngrok.io" // FROM USER
	scheme := "http"
	grpcPort := 10877 // FROM USER
	memoryTotal := 8192
	diskTotal := 102400
	daemonToken := "ironhost-local-token-123" // HARDCODED TOKEN

	// Check if node exists
	var exists bool
	err = conn.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM nodes WHERE name=$1)", nodeName).Scan(&exists)
	if err != nil {
		log.Fatalf("Failed to check existing node: %v", err)
	}

	if exists {
		// Update existing node
		fmt.Printf("Updating existing node '%s'...\n", nodeName)
		_, err = conn.Exec(context.Background(), `
			UPDATE nodes 
			SET fqdn=$2, scheme=$3, grpc_port=$4, daemon_token_hash=$5, updated_at=NOW()
			WHERE name=$1
		`, nodeName, fqdn, scheme, grpcPort, daemonToken)
	} else {
		// Insert new node
		fmt.Printf("Inserting new node '%s'...\n", nodeName)
		_, err = conn.Exec(context.Background(), `
			INSERT INTO nodes (name, fqdn, scheme, grpc_port, memory_total, disk_total, daemon_token_hash)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, nodeName, fqdn, scheme, grpcPort, memoryTotal, diskTotal, daemonToken)
	}

	if err != nil {
		log.Fatalf("Failed to upsert node: %v", err)
	}

	fmt.Println("\n✅ Node setup complete!")
	fmt.Printf("   Node Name:    %s\n", nodeName)
	fmt.Printf("   Address:      %s:%d\n", fqdn, grpcPort)
	fmt.Printf("   Daemon Token: %s\n", daemonToken)
	fmt.Println("\n👉 Start your Agent with this command:")
	fmt.Printf("   go run cmd/agent/main.go -port 50051 -insecure -token \"%s\"\n", daemonToken)
}
