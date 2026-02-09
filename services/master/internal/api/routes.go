package api

import (
	"github.com/gofiber/fiber/v2"

	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
)

// RegisterRoutes registers all API routes
func RegisterRoutes(app *fiber.App, db *database.DB, grpcPool *mastergrpc.ClientPool) {
	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		if err := db.Health(c.Context()); err != nil {
			return c.Status(503).JSON(fiber.Map{"status": "unhealthy", "error": err.Error()})
		}
		return c.JSON(fiber.Map{"status": "healthy"})
	})

	// API v1 routes
	v1 := app.Group("/api/v1")

	// Auth routes (public)
	auth := v1.Group("/auth")
	authHandler := NewAuthHandler(db)
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)

	// Billing routes (public for plans)
	billing := v1.Group("/billing")
	billingHandler := NewBillingHandler(db)
	billing.Get("/plans", billingHandler.ListPlans)

	// Protected routes (require JWT)
	protected := v1.Group("")
	protected.Use(JWTMiddleware())

	// Auth - me endpoint
	protected.Get("/auth/me", authHandler.Me)

	// Billing - protected endpoints
	protected.Get("/billing/subscription", billingHandler.GetSubscription)
	protected.Post("/billing/subscribe", billingHandler.Subscribe)
	protected.Get("/billing/invoices", billingHandler.ListInvoices)

	// Node management
	nodes := protected.Group("/nodes")
	nodeHandler := NewNodeHandler(db, grpcPool)
	nodes.Get("/", nodeHandler.List)
	nodes.Get("/:id", nodeHandler.Get)
	nodes.Post("/", nodeHandler.Create)
	nodes.Put("/:id", nodeHandler.Update)
	nodes.Delete("/:id", nodeHandler.Delete)
	nodes.Get("/:id/stats", nodeHandler.GetStats)

	// Server management
	servers := protected.Group("/servers")
	serverHandler := NewServerHandler(db, grpcPool)
	servers.Get("/", serverHandler.List)
	servers.Get("/:id", serverHandler.Get)
	servers.Post("/", serverHandler.Create)
	servers.Put("/:id", serverHandler.Update)
	servers.Delete("/:id", serverHandler.Delete)

	// Server actions
	servers.Post("/:id/start", serverHandler.Start)
	servers.Post("/:id/stop", serverHandler.Stop)
	servers.Post("/:id/restart", serverHandler.Restart)
	servers.Post("/:id/command", serverHandler.SendCommand)
	servers.Get("/:id/console", serverHandler.StreamConsole) // WebSocket upgrade

	// Allocations
	allocations := protected.Group("/allocations")
	allocationHandler := NewAllocationHandler(db)
	allocations.Get("/", allocationHandler.List)
	allocations.Post("/", allocationHandler.Create)
	allocations.Delete("/:id", allocationHandler.Delete)
}

// ErrorHandler is the custom error handler for Fiber
func ErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return c.Status(code).JSON(fiber.Map{
		"error":   true,
		"message": err.Error(),
	})
}
