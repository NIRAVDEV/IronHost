package api

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
	agentpb "github.com/ironhost/master/internal/grpc/ironhost/v1"
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
	nodes, err := h.db.ListNodes(c.Context())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to list nodes")
	}
	return c.JSON(fiber.Map{"nodes": nodes})
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
		Location    string `json:"location"`
		MemoryTotal int64  `json:"memory_total"`
		DiskTotal   int64  `json:"disk_total"`
		DaemonToken string `json:"daemon_token"`
	}

	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	if req.Scheme == "" {
		req.Scheme = "http" // Default to http for insecure mode
	}
	if req.GRPCPort == 0 {
		req.GRPCPort = 8443
	}

	// Store the token plaintext for simplicity (in production, hash it)
	// For now we just store plaintext since Agent also gets plaintext
	daemonTokenHash := req.DaemonToken

	node, err := h.db.CreateNode(c.Context(), req.Name, req.FQDN, req.Scheme, req.GRPCPort, req.MemoryTotal, req.DiskTotal, daemonTokenHash, req.Location)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create node: "+err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":      "node created",
		"node":         node,
		"daemon_token": req.DaemonToken, // Return token for Agent configuration
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

	if err := h.db.DeleteNode(c.Context(), id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to delete node")
	}

	return c.JSON(fiber.Map{"message": "node deleted"})
}

// GetStats returns real-time resource stats from a registered node
func (h *NodeHandler) GetStats(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid node ID")
	}

	// Get node from database
	node, err := h.db.GetNodeByID(c.Context(), id)
	if err != nil || node == nil {
		return fiber.NewError(fiber.StatusNotFound, "node not found")
	}

	// Connect to agent via gRPC
	conn, err := h.grpcPool.GetClient(node.GetAddress())
	if err != nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "failed to connect to agent: "+err.Error())
	}

	client := agentpb.NewAgentServiceClient(conn)

	// Add token auth
	ctx := metadata.AppendToOutgoingContext(
		context.Background(),
		"authorization", "Bearer "+node.DaemonTokenHash,
	)

	// Call GetNodeStats RPC
	stats, err := client.GetNodeStats(ctx, &emptypb.Empty{})
	if err != nil {
		log.Printf("GetNodeStats RPC failed for node %s: %v", node.Name, err)
		return fiber.NewError(fiber.StatusServiceUnavailable, "failed to get node stats: "+err.Error())
	}

	return c.JSON(fiber.Map{
		"stats": fiber.Map{
			"node_id":                node.ID,
			"node_name":              node.Name,
			"total_memory_bytes":     stats.TotalMemoryBytes,
			"available_memory_bytes": stats.AvailableMemoryBytes,
			"total_disk_bytes":       stats.TotalDiskBytes,
			"available_disk_bytes":   stats.AvailableDiskBytes,
			"cpu_usage_percent":      stats.CpuUsagePercent,
			"running_containers":     stats.RunningContainers,
			"uptime_seconds":         stats.UptimeSeconds,
		},
	})
}

// Probe tests connection to an agent and returns auto-detected system resources
// This is called BEFORE saving the node to verify connectivity and get resource info
func (h *NodeHandler) Probe(c *fiber.Ctx) error {
	var req struct {
		FQDN        string `json:"fqdn"`
		GRPCPort    int    `json:"grpc_port"`
		Scheme      string `json:"scheme"`
		DaemonToken string `json:"daemon_token"`
	}

	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	if req.FQDN == "" {
		return fiber.NewError(fiber.StatusBadRequest, "fqdn is required")
	}
	if req.GRPCPort == 0 {
		req.GRPCPort = 8443
	}

	address := fmt.Sprintf("%s:%d", req.FQDN, req.GRPCPort)

	// Create a temporary gRPC connection (not via pool — this node isn't saved yet)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "failed to connect to agent at "+address+": "+err.Error())
	}
	defer conn.Close()

	client := agentpb.NewAgentServiceClient(conn)

	// Add token auth
	rpcCtx := metadata.AppendToOutgoingContext(ctx,
		"authorization", "Bearer "+req.DaemonToken,
	)

	// First, ping to verify authentication
	_, err = client.Ping(rpcCtx, &emptypb.Empty{})
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "agent connection failed (bad token?): "+err.Error())
	}

	// Then, get full system stats
	stats, err := client.GetNodeStats(rpcCtx, &emptypb.Empty{})
	if err != nil {
		log.Printf("Probe: GetNodeStats failed for %s: %v", address, err)
		// Ping worked so agent is reachable, just stats failed
		return c.JSON(fiber.Map{
			"success":   true,
			"reachable": true,
			"stats":     nil,
			"message":   "Agent reachable but stats unavailable",
		})
	}

	return c.JSON(fiber.Map{
		"success":   true,
		"reachable": true,
		"stats": fiber.Map{
			"total_memory_bytes":     stats.TotalMemoryBytes,
			"available_memory_bytes": stats.AvailableMemoryBytes,
			"total_disk_bytes":       stats.TotalDiskBytes,
			"available_disk_bytes":   stats.AvailableDiskBytes,
			"cpu_usage_percent":      stats.CpuUsagePercent,
			"running_containers":     stats.RunningContainers,
			"uptime_seconds":         stats.UptimeSeconds,
		},
	})
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
