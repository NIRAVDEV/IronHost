package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
)

// NodeHandler handles node-related API requests
type NodeHandler struct {
	db       *database.DB
	grpcPool *mastergrpc.ClientPool
}

// NewNodeHandler creates a new node handler
func NewNodeHandler(db *database.DB, grpcPool *mastergrpc.ClientPool) *NodeHandler {
	return &NodeHandler{db: db, grpcPool: grpcPool}
}

// List returns all nodes
func (h *NodeHandler) List(c *fiber.Ctx) error {
	// TODO: Implement database query
	return c.JSON(fiber.Map{"nodes": []interface{}{}})
}

// Get returns a specific node
func (h *NodeHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid node ID")
	}
	_ = id
	return c.JSON(fiber.Map{"node": nil})
}

// Create registers a new node
func (h *NodeHandler) Create(c *fiber.Ctx) error {
	var req struct {
		Name        string `json:"name"`
		FQDN        string `json:"fqdn"`
		Scheme      string `json:"scheme"`
		GRPCPort    int    `json:"grpc_port"`
		MemoryTotal int64  `json:"memory_total"`
		DiskTotal   int64  `json:"disk_total"`
	}

	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// TODO:
	// 1. Generate daemon token
	// 2. Save to database
	// 3. Return token for agent configuration

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "node created",
		"node_id": uuid.New(),
	})
}

// Update updates node configuration
func (h *NodeHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid node ID")
	}
	_ = id
	return c.JSON(fiber.Map{"message": "node updated"})
}

// Delete removes a node
func (h *NodeHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid node ID")
	}
	_ = id
	return c.JSON(fiber.Map{"message": "node deleted"})
}

// GetStats returns real-time resource stats from the node
func (h *NodeHandler) GetStats(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid node ID")
	}

	// TODO:
	// 1. Get node from database
	// 2. Connect to agent via gRPC
	// 3. Call GetNodeStats RPC
	_ = id
	return c.JSON(fiber.Map{"stats": nil})
}

// AllocationHandler handles allocation-related API requests
type AllocationHandler struct {
	db *database.DB
}

// NewAllocationHandler creates a new allocation handler
func NewAllocationHandler(db *database.DB) *AllocationHandler {
	return &AllocationHandler{db: db}
}

// List returns allocations (optionally filtered by node)
func (h *AllocationHandler) List(c *fiber.Ctx) error {
	nodeID := c.Query("node_id")
	_ = nodeID
	return c.JSON(fiber.Map{"allocations": []interface{}{}})
}

// Create creates new port allocations
func (h *AllocationHandler) Create(c *fiber.Ctx) error {
	var req struct {
		NodeID    uuid.UUID `json:"node_id"`
		IPAddress string    `json:"ip_address"`
		PortStart int       `json:"port_start"`
		PortEnd   int       `json:"port_end"`
	}

	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// TODO: Create allocations in database
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "allocations created",
		"count":   req.PortEnd - req.PortStart + 1,
	})
}

// Delete removes an allocation
func (h *AllocationHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid allocation ID")
	}
	_ = id
	return c.JSON(fiber.Map{"message": "allocation deleted"})
}
