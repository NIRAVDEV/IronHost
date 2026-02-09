package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/ironhost/master/internal/api"
	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
)

var (
	httpPort   = flag.Int("http-port", 3000, "HTTP API server port")
	dbHost     = flag.String("db-host", "localhost", "PostgreSQL host")
	dbPort     = flag.Int("db-port", 5432, "PostgreSQL port")
	dbUser     = flag.String("db-user", "ironhost", "PostgreSQL user")
	dbPassword = flag.String("db-password", "", "PostgreSQL password")
	dbName     = flag.String("db-name", "ironhost", "PostgreSQL database name")
	redisAddr  = flag.String("redis-addr", "localhost:6379", "Redis address")
	certDir    = flag.String("cert-dir", "/etc/ironhost/certs", "Directory containing mTLS certificates")
)

func main() {
	flag.Parse()

	log.Println("IronHost Master Control Plane starting...")

	// Initialize database connection
	var db *database.DB
	var err error

	// Check for DATABASE_URL environment variable (for Supabase/production)
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		log.Println("Using DATABASE_URL from environment")
		db, err = database.NewConnectionFromURL(dbURL, 10)
	} else {
		// Fall back to flag-based config (for local development)
		dbConfig := database.Config{
			Host:     *dbHost,
			Port:     *dbPort,
			User:     *dbUser,
			Password: *dbPassword,
			Database: *dbName,
		}
		db, err = database.NewConnection(dbConfig)
	}

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize gRPC client pool for agent connections
	grpcPool := mastergrpc.NewClientPool(*certDir)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "IronHost Master",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		ErrorHandler: api.ErrorHandler,
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} ${method} ${path} ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*", // Configure appropriately for production
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Register API routes
	api.RegisterRoutes(app, db, grpcPool)

	// Start server in goroutine
	go func() {
		addr := fmt.Sprintf(":%d", *httpPort)
		log.Printf("HTTP API listening on %s", addr)
		if err := app.Listen(addr); err != nil {
			log.Fatalf("Failed to start HTTP server: %v", err)
		}
	}()

	// Graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("Received shutdown signal, gracefully stopping...")

	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 30*time.Second)
	defer shutdownCancel()

	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}

	grpcPool.CloseAll()
	log.Println("Master Control Plane shutdown complete")
}
