package api

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"google.golang.org/grpc/metadata"

	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
	agentpb "github.com/ironhost/master/internal/grpc/ironhost/v1"
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

// List returns all servers
func (h *ServerHandler) List(c *fiber.Ctx) error {
	servers, err := h.db.ListServers(c.Context())
	if err != nil {
		log.Printf("Failed to list servers: %v", err)
		return c.JSON(fiber.Map{"servers": []interface{}{}})
	}
	return c.JSON(fiber.Map{"servers": servers})
}

// Get returns a specific server by ID
func (h *ServerHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	server, err := h.db.GetServer(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	return c.JSON(fiber.Map{"server": server})
}

// Create creates a new game server
func (h *ServerHandler) Create(c *fiber.Ctx) error {
	var req models.ServerCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// TODO: Get user ID from auth context (JWT claims)
	// PROVISIONAL FIX: Use existing user ID from DB
	userID := uuid.MustParse("a010b479-4317-4cfb-9952-188566a8e40d")

	// Look up the target node
	node, err := h.db.GetNodeByID(c.Context(), req.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "node not found: "+err.Error())
	}

	// Create server model with defaults
	server := models.NewServerFromRequest(req, userID)

	// 1. Save to database
	if err := h.db.CreateServer(c.Context(), server); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to save server: "+err.Error())
	}

	// 2. Assign a port allocation
	allocation, err := h.db.AssignAllocation(c.Context(), server.ID, server.NodeID)
	if err != nil {
		log.Printf("Failed to assign allocation for server %s: %v", server.ID, err)
		// Server is saved but has no allocation — still return success
		// The allocation can be retried later
	}

	// 3. Send CreateServer RPC to agent (async — don't block the HTTP response)
	// 3. Send CreateServer RPC to agent (async — don't block the HTTP response)
	go func() {
		// Use a detached context with timeout for background work
		ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		defer cancel()

		if err := h.createServerOnAgent(server, node, allocation); err != nil {
			log.Printf("Failed to create server %s on agent: %v", server.ID, err)
			// Update status to reflect failure
			_ = h.db.UpdateServerStatus(ctx, server.ID, models.StatusOffline)
		} else {
			log.Printf("Server %s created successfully, updating status to running", server.ID)
			_ = h.db.UpdateServerStatus(ctx, server.ID, models.StatusRunning)
		}
	}()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"server":  server,
		"message": "Server creation initiated",
	})
}

// createServerOnAgent sends the CreateServer RPC to the agent node
func (h *ServerHandler) createServerOnAgent(server *models.Server, node *database.Node, allocation *models.Allocation) error {
	log.Printf("DEBUG: Connecting to agent at %s for server %s", node.GetAddress(), server.ID)
	// Connect to agent
	conn, err := h.grpcPool.GetClient(node.GetAddress())
	if err != nil {
		return fmt.Errorf("failed to connect to agent: %w", err)
	}

	client := agentpb.NewAgentServiceClient(conn)

	// Add token authentication metadata
	ctx := metadata.AppendToOutgoingContext(
		context.Background(),
		"authorization", "Bearer "+node.DaemonTokenHash,
	)

	// Build environment variables
	var envVars []*agentpb.EnvVar
	for k, v := range server.Environment {
		envVars = append(envVars, &agentpb.EnvVar{Key: k, Value: v})
	}

	// Build allocations
	var allocations []*agentpb.Allocation
	if allocation != nil {
		allocations = append(allocations, &agentpb.Allocation{
			Port:      int32(allocation.Port),
			IsPrimary: true,
		})
	}

	log.Printf("DEBUG: Sending CreateServer RPC to agent %s...", node.Name)
	// Send RPC
	resp, err := client.CreateServer(ctx, &agentpb.CreateServerRequest{
		ServerId:    server.ID.String(),
		Name:        server.Name,
		DockerImage: server.DockerImage,
		Limits: &agentpb.ResourceLimits{
			MemoryMb:   server.MemoryLimit,
			DiskMb:     server.DiskLimit,
			CpuPercent: int32(server.CPULimit),
		},
		Allocations:   allocations,
		Environment:   envVars,
		DataDirectory: fmt.Sprintf("/var/lib/ironhost/servers/%s", server.ID.String()),
	})

	if err != nil {
		log.Printf("DEBUG: CreateServer RPC failed with error: %v", err)
		return fmt.Errorf("CreateServer RPC failed: %w", err)
	}

	if !resp.Success {
		log.Printf("DEBUG: Agent returned success=false: %s", resp.ErrorMessage)
		return fmt.Errorf("agent reported failure: %s", resp.ErrorMessage)
	}

	log.Printf("DEBUG: Server %s created on agent, container: %s", server.ID, resp.ContainerId)
	return nil
}

// Update updates server settings
func (h *ServerHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	_ = id
	return c.JSON(fiber.Map{"message": "server updated"})
}

// Delete removes a server
func (h *ServerHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	// Fetch server to get node info
	server, err := h.db.GetServer(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	// Get node for gRPC connection
	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	// Send DeleteServer RPC to agent
	conn, err := h.grpcPool.GetClient(node.GetAddress())
	if err == nil {
		client := agentpb.NewAgentServiceClient(conn)
		ctx := metadata.AppendToOutgoingContext(
			c.Context(),
			"authorization", "Bearer "+node.DaemonTokenHash,
		)
		resp, rpcErr := client.DeleteServer(ctx, &agentpb.ServerIdentifier{
			ServerId: server.ID.String(),
		})
		if rpcErr != nil {
			log.Printf("DeleteServer RPC failed: %v", rpcErr)
		} else if !resp.Success {
			log.Printf("Agent reported delete failure: %s", resp.ErrorMessage)
		}
	}

	// Remove from database
	if err := h.db.DeleteServer(c.Context(), id); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to delete server")
	}

	return c.JSON(fiber.Map{"message": "server deleted"})
}

// Start starts a stopped server
func (h *ServerHandler) Start(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	server, err := h.db.GetServer(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}

	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	resp, err := client.StartServer(ctx, &agentpb.ServerIdentifier{ServerId: server.ID.String()})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "StartServer RPC failed: "+err.Error())
	}
	if !resp.Success {
		return fiber.NewError(fiber.StatusInternalServerError, resp.ErrorMessage)
	}

	_ = h.db.UpdateServerStatus(c.Context(), id, models.StatusRunning)
	return c.JSON(fiber.Map{"message": "server starting"})
}

// Stop stops a running server
func (h *ServerHandler) Stop(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	server, err := h.db.GetServer(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}

	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	resp, err := client.StopServer(ctx, &agentpb.StopServerRequest{
		ServerId:       server.ID.String(),
		TimeoutSeconds: 30,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "StopServer RPC failed: "+err.Error())
	}
	if !resp.Success {
		return fiber.NewError(fiber.StatusInternalServerError, resp.ErrorMessage)
	}

	_ = h.db.UpdateServerStatus(c.Context(), id, models.StatusOffline)
	return c.JSON(fiber.Map{"message": "server stopping"})
}

// Restart restarts a server
func (h *ServerHandler) Restart(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	server, err := h.db.GetServer(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}

	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	resp, err := client.RestartServer(ctx, &agentpb.ServerIdentifier{ServerId: server.ID.String()})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "RestartServer RPC failed: "+err.Error())
	}
	if !resp.Success {
		return fiber.NewError(fiber.StatusInternalServerError, resp.ErrorMessage)
	}

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

	server, err := h.db.GetServer(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress())
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}

	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	_, err = client.SendCommand(ctx, &agentpb.SendCommandRequest{
		ServerId: server.ID.String(),
		Command:  req.Command,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "SendCommand RPC failed: "+err.Error())
	}

	return c.JSON(fiber.Map{"message": "command sent"})
}

// StreamConsole upgrades to WebSocket for console streaming
func (h *ServerHandler) StreamConsole(c *fiber.Ctx) error {
	return fiber.NewError(fiber.StatusNotImplemented, "console streaming not yet implemented")
}
