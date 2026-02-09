package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
	"github.com/ironhost/master/internal/models"
)

// ServerHandler handles server-related API requests
type ServerHandler struct {
	db       *database.DB
	grpcPool *mastergrpc.ClientPool
}

// NewServerHandler creates a new server handler
func NewServerHandler(db *database.DB, grpcPool *mastergrpc.ClientPool) *ServerHandler {
	return &ServerHandler{db: db, grpcPool: grpcPool}
}

// List returns all servers (optionally filtered by user)
func (h *ServerHandler) List(c *fiber.Ctx) error {
	// TODO: Implement with proper pagination and user filtering
	return c.JSON(fiber.Map{"servers": []interface{}{}})
}

// Get returns a specific server by ID
func (h *ServerHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	// TODO: Fetch from database
	_ = id
	return c.JSON(fiber.Map{"server": nil})
}

// Create creates a new game server
func (h *ServerHandler) Create(c *fiber.Ctx) error {
	var req models.ServerCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// TODO: Get user ID from auth context
	userID := uuid.New() // Placeholder

	// Create server model with defaults (uses itzg/minecraft-server and TYPE env var)
	server := models.NewServerFromRequest(req, userID)

	// TODO:
	// 1. Save to database
	// 2. Find available allocation on node
	// 3. Send CreateServer RPC to agent
	// 4. Update server status

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"server":  server,
		"message": "Server creation initiated",
	})
}

// Update updates server settings
func (h *ServerHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	// TODO: Implement update logic
	_ = id
	return c.JSON(fiber.Map{"message": "server updated"})
}

// Delete removes a server
func (h *ServerHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	// TODO:
	// 1. Send DeleteServer RPC to agent
	// 2. Remove from database
	_ = id
	return c.JSON(fiber.Map{"message": "server deleted"})
}

// Start starts a stopped server
func (h *ServerHandler) Start(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	// TODO: Send StartServer RPC to agent
	_ = id
	return c.JSON(fiber.Map{"message": "server starting"})
}

// Stop stops a running server
func (h *ServerHandler) Stop(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	// TODO: Send StopServer RPC to agent
	_ = id
	return c.JSON(fiber.Map{"message": "server stopping"})
}

// Restart restarts a server
func (h *ServerHandler) Restart(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	// TODO: Send RestartServer RPC to agent
	_ = id
	return c.JSON(fiber.Map{"message": "server restarting"})
}

// SendCommand sends a console command to the server
func (h *ServerHandler) SendCommand(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	var req struct {
		Command string `json:"command"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// TODO: Send command via gRPC to agent
	_ = id
	_ = req.Command
	return c.JSON(fiber.Map{"message": "command sent"})
}

// StreamConsole upgrades to WebSocket for console streaming
func (h *ServerHandler) StreamConsole(c *fiber.Ctx) error {
	// TODO: Implement WebSocket upgrade and console streaming
	return fiber.NewError(fiber.StatusNotImplemented, "console streaming not yet implemented")
}
