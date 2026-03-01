package api

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"google.golang.org/grpc/metadata"

	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
	agentpb "github.com/ironhost/master/internal/grpc/ironhost/v1"
	"github.com/ironhost/master/internal/models"
)

// blockedCommands are commands that must NOT be sent via the console.
// Server lifecycle should only be controlled through the dashboard buttons.
var blockedCommands = map[string]bool{
	"stop":     true,
	"end":      true,
	"shutdown": true,
}

// isCommandBlocked returns true if the command (case-insensitive, first word)
// matches any entry in the blocklist.
func isCommandBlocked(raw string) bool {
	cmd := strings.TrimSpace(raw)
	if cmd == "" {
		return false
	}
	// Extract the first word (the base command)
	base := strings.ToLower(strings.Fields(cmd)[0])
	return blockedCommands[base]
}

// ServerHandler handles server-related API requests
type ServerHandler struct {
	db       *database.DB
	grpcPool *mastergrpc.ClientPool
}

// NewServerHandler creates a new server handler
func NewServerHandler(db *database.DB, grpcPool *mastergrpc.ClientPool) *ServerHandler {
	return &ServerHandler{db: db, grpcPool: grpcPool}
}

// getServerForUser fetches a server and verifies ownership. Returns 404 if
// the server doesn't exist or doesn't belong to this user.
func (h *ServerHandler) getServerForUser(c *fiber.Ctx) (*models.Server, error) {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	userID := c.Locals("userID").(uuid.UUID)

	server, err := h.db.GetServer(c.Context(), id)
	if err != nil || server.UserID != userID {
		return nil, fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	return server, nil
}

// List returns servers belonging to the authenticated user
func (h *ServerHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uuid.UUID)

	servers, err := h.db.ListServersByUserID(c.Context(), userID)
	if err != nil {
		log.Printf("Failed to list servers: %v", err)
		return c.JSON(fiber.Map{"servers": []interface{}{}})
	}
	return c.JSON(fiber.Map{"servers": servers})
}

// Get returns a specific server (only if the user owns it)
func (h *ServerHandler) Get(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{"server": server})
}

// Create creates a new game server
func (h *ServerHandler) Create(c *fiber.Ctx) error {
	var req models.ServerCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// Get authenticated user ID from JWT claims (set by JWTMiddleware)
	userID := c.Locals("userID").(uuid.UUID)

	// Look up the target node
	node, err := h.db.GetNodeByID(c.Context(), req.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "node not found: "+err.Error())
	}

	// Create server model with defaults
	server := models.NewServerFromRequest(req, userID)

	// Validate user has enough resources in their pool
	user, err := h.db.GetUserByID(c.Context(), userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get user")
	}
	usage, _ := h.db.GetResourceUsage(c.Context(), userID)

	freeRAM := int64(user.ResourceRAM - usage.RAMUsed)
	freeCPU := int64(user.ResourceCPU - usage.CPUUsed)
	freeStorage := int64(user.ResourceStorage - usage.StorageUsed)

	if server.MemoryLimit > freeRAM {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("Not enough RAM: need %d MB, have %d MB free. Purchase more in the Store.", server.MemoryLimit, freeRAM))
	}
	if server.CPULimit > 0 && int64(server.CPULimit) > freeCPU {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("Not enough CPU: need %d cores, have %d free. Purchase more in the Store.", server.CPULimit, freeCPU))
	}
	if server.DiskLimit > freeStorage {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("Not enough Storage: need %d MB, have %d MB free. Purchase more in the Store.", server.DiskLimit, freeStorage))
	}

	// Deduct 50 IHC for server creation
	if err := h.db.SpendCoins(c.Context(), userID, 50, "Server creation: "+server.Name); err != nil {
		return fiber.NewError(fiber.StatusPaymentRequired, err.Error())
	}

	// 1. Save to database
	if err := h.db.CreateServer(c.Context(), server); err != nil {
		// Refund coins if DB save fails
		_ = h.db.AddCoins(c.Context(), userID, 50, "refund", "earned", "Server creation failed - refund")
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
	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
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

// Update updates server settings (name + resources)
func (h *ServerHandler) Update(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	userID := c.Locals("userID").(uuid.UUID)

	var req struct {
		Name        *string `json:"name"`
		MemoryLimit *int64  `json:"memory_limit"`
		CPULimit    *int    `json:"cpu_limit"`
		DiskLimit   *int64  `json:"disk_limit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// Update name if provided
	if req.Name != nil && *req.Name != "" {
		if len(*req.Name) < 2 || len(*req.Name) > 50 {
			return fiber.NewError(fiber.StatusBadRequest, "name must be between 2 and 50 characters")
		}
		if err := h.db.UpdateServerName(c.Context(), server.ID, *req.Name); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to update server name")
		}
	}

	// Update resources if any provided
	newMemory := server.MemoryLimit
	newCPU := server.CPULimit
	newDisk := server.DiskLimit

	if req.MemoryLimit != nil {
		newMemory = *req.MemoryLimit
	}
	if req.CPULimit != nil {
		newCPU = *req.CPULimit
	}
	if req.DiskLimit != nil {
		newDisk = *req.DiskLimit
	}

	// Validate resource changes against user pool
	if newMemory != server.MemoryLimit || newCPU != server.CPULimit || newDisk != server.DiskLimit {
		user, err := h.db.GetUserByID(c.Context(), userID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to get user")
		}

		usage, _ := h.db.GetResourceUsage(c.Context(), userID)

		// Available = pool total - used by OTHER servers (exclude current server)
		freeRAM := int64(user.ResourceRAM) - (int64(usage.RAMUsed) - server.MemoryLimit)
		freeCPU := user.ResourceCPU - (usage.CPUUsed - server.CPULimit)
		freeStorage := int64(user.ResourceStorage) - (int64(usage.StorageUsed) - server.DiskLimit)

		if newMemory > freeRAM {
			return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("not enough RAM — %d MB free", freeRAM))
		}
		if newCPU > freeCPU {
			return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("not enough CPU — %d%% free", freeCPU))
		}
		if newDisk > freeStorage {
			return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("not enough storage — %d MB free", freeStorage))
		}

		if newMemory < 256 {
			return fiber.NewError(fiber.StatusBadRequest, "minimum 256 MB RAM required")
		}
		if newCPU < 25 {
			return fiber.NewError(fiber.StatusBadRequest, "minimum 25% CPU required")
		}
		if newDisk < 512 {
			return fiber.NewError(fiber.StatusBadRequest, "minimum 512 MB storage required")
		}

		if err := h.db.UpdateServerResources(c.Context(), server.ID, newMemory, newCPU, newDisk); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to update server resources")
		}
	}

	// Return updated server
	updated, _ := h.db.GetServer(c.Context(), server.ID)
	return c.JSON(fiber.Map{"server": updated})
}

// ResetServer wipes and recreates the server container (data loss)
func (h *ServerHandler) ResetServer(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	// Get node info for gRPC connection
	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get node")
	}

	// Stop the server first if running
	if server.Status == models.StatusRunning || server.Status == models.StatusStarting {
		conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
		if err == nil {
			client := agentpb.NewAgentServiceClient(conn)
			ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)
			_, _ = client.StopServer(ctx, &agentpb.StopServerRequest{
				ServerId:       server.ID.String(),
				TimeoutSeconds: 10,
			})
		}
	}

	// Delete container on agent
	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}
	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	_, err = client.DeleteServer(ctx, &agentpb.ServerIdentifier{ServerId: server.ID.String()})
	if err != nil {
		log.Printf("Failed to delete container on agent during reset: %v", err)
	}

	// Update status to installing
	_ = h.db.UpdateServerStatus(c.Context(), server.ID, models.StatusInstalling)

	// Recreate the server on the agent in background
	go func() {
		allocation := server.PrimaryAllocation
		if allocation == nil {
			_ = h.db.UpdateServerStatus(context.Background(), server.ID, models.StatusOffline)
			return
		}

		err := h.createServerOnAgent(server, node, allocation)
		if err != nil {
			log.Printf("Failed to recreate server %s after reset: %v", server.ID, err)
			_ = h.db.UpdateServerStatus(context.Background(), server.ID, models.StatusOffline)
		}
	}()

	return c.JSON(fiber.Map{
		"message": "Server reset initiated. The container will be recreated.",
	})
}

// Delete removes a server (only if the user owns it)
func (h *ServerHandler) Delete(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	// Get node for gRPC connection
	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	// Send DeleteServer RPC to agent
	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
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
	if err := h.db.DeleteServer(c.Context(), server.ID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to delete server")
	}

	// Refund 25 IHC on server deletion
	userID := c.Locals("userID").(uuid.UUID)
	_ = h.db.AddCoins(c.Context(), userID, 25, "refund", "earned", "Server deleted: "+server.Name)

	return c.JSON(fiber.Map{"message": "server deleted", "ihc_refunded": 25})
}

// Start starts a stopped server (only if the user owns it)
func (h *ServerHandler) Start(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
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

	_ = h.db.UpdateServerStatus(c.Context(), server.ID, models.StatusRunning)
	return c.JSON(fiber.Map{"message": "server starting"})
}

// Stop stops a running server (only if the user owns it)
func (h *ServerHandler) Stop(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
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

	_ = h.db.UpdateServerStatus(c.Context(), server.ID, models.StatusOffline)
	return c.JSON(fiber.Map{"message": "server stopping"})
}

// Restart restarts a server (only if the user owns it)
func (h *ServerHandler) Restart(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
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

// SendCommand sends a console command to the server (only if the user owns it)
func (h *ServerHandler) SendCommand(c *fiber.Ctx) error {
	var req struct {
		Command string `json:"command"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// Block dangerous commands — must use dashboard buttons instead
	if isCommandBlocked(req.Command) {
		return fiber.NewError(fiber.StatusForbidden, "this command is restricted — use the dashboard buttons to control the server")
	}

	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}

	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	resp, err := client.SendCommand(ctx, &agentpb.SendCommandRequest{
		ServerId: server.ID.String(),
		Command:  req.Command,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "SendCommand RPC failed: "+err.Error())
	}

	output := ""
	if resp != nil {
		output = resp.ErrorMessage // ErrorMessage field carries the rcon output
	}

	return c.JSON(fiber.Map{"message": "command sent", "output": output})
}

// GetLogs returns recent server logs via Agent's GetLogs RPC (only if the user owns it)
func (h *ServerHandler) GetLogs(c *fiber.Ctx) error {
	server, err := h.getServerForUser(c)
	if err != nil {
		return err
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}

	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	resp, err := client.GetLogs(ctx, &agentpb.ServerIdentifier{ServerId: server.ID.String()})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "GetLogs RPC failed: "+err.Error())
	}

	// Split the log text into lines
	logText := resp.ErrorMessage
	var lines []string
	if logText != "" {
		for _, line := range strings.Split(logText, "\n") {
			if line != "" {
				lines = append(lines, line)
			}
		}
	}

	return c.JSON(fiber.Map{"logs": lines})
}

// StreamConsole is the WebSocket handler for real-time console streaming.
// It bridges the Agent's gRPC StreamConsole to the frontend via WebSocket.
// It also accepts incoming "command" messages and forwards them via SendCommand RPC.
func (h *ServerHandler) StreamConsoleWS(c *websocket.Conn) {
	serverIDStr := c.Params("id")
	userIDStr := c.Locals("userID")
	if userIDStr == nil {
		log.Println("WebSocket: no userID in context")
		c.WriteJSON(fiber.Map{"type": "error", "message": "unauthorized"})
		return
	}
	userID, ok := userIDStr.(uuid.UUID)
	if !ok {
		log.Println("WebSocket: invalid userID type")
		c.WriteJSON(fiber.Map{"type": "error", "message": "unauthorized"})
		return
	}

	serverID, err := uuid.Parse(serverIDStr)
	if err != nil {
		c.WriteJSON(fiber.Map{"type": "error", "message": "invalid server ID"})
		return
	}

	// Verify ownership
	server, err := h.db.GetServer(context.Background(), serverID)
	if err != nil || server.UserID != userID {
		c.WriteJSON(fiber.Map{"type": "error", "message": "server not found"})
		return
	}

	node, err := h.db.GetNodeByID(context.Background(), server.NodeID)
	if err != nil {
		c.WriteJSON(fiber.Map{"type": "error", "message": "node not found"})
		return
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
	if err != nil {
		c.WriteJSON(fiber.Map{"type": "error", "message": "failed to connect to agent"})
		return
	}

	client := agentpb.NewAgentServiceClient(conn)
	grpcCtx, grpcCancel := context.WithCancel(context.Background())
	grpcCtx = metadata.AppendToOutgoingContext(grpcCtx, "authorization", "Bearer "+node.DaemonTokenHash)
	defer grpcCancel()

	// Send initial status
	c.WriteJSON(fiber.Map{"type": "status", "status": server.Status})

	// --- goroutine 1: stream gRPC console logs → WebSocket ---
	go func() {
		defer grpcCancel()

		stream, err := client.StreamConsole(grpcCtx, &agentpb.ServerIdentifier{ServerId: server.ID.String()})
		if err != nil {
			log.Printf("WebSocket: StreamConsole RPC failed: %v", err)
			c.WriteJSON(fiber.Map{"type": "error", "message": "failed to start console stream: " + err.Error()})
			return
		}

		for {
			msg, err := stream.Recv()
			if err != nil {
				if grpcCtx.Err() != nil {
					return // context cancelled, clean shutdown
				}
				log.Printf("WebSocket: StreamConsole recv error: %v", err)
				return
			}
			if err := c.WriteJSON(fiber.Map{
				"type":      "log",
				"line":      msg.Line,
				"timestamp": msg.Timestamp,
			}); err != nil {
				return // WebSocket closed
			}
		}
	}()

	// --- goroutine 2: poll server status every 3s → WebSocket ---
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		lastStatus := server.Status

		for {
			select {
			case <-grpcCtx.Done():
				return
			case <-ticker.C:
				srv, err := h.db.GetServer(context.Background(), serverID)
				if err != nil {
					continue
				}
				if srv.Status != lastStatus {
					lastStatus = srv.Status
					if err := c.WriteJSON(fiber.Map{"type": "status", "status": lastStatus}); err != nil {
						return
					}
				}
			}
		}
	}()

	// --- main loop: read WebSocket messages (commands from user) ---
	for {
		var msg struct {
			Type    string `json:"type"`
			Command string `json:"command"`
		}
		if err := c.ReadJSON(&msg); err != nil {
			// WebSocket closed or read error
			break
		}

		if msg.Type == "command" && msg.Command != "" {
			// Block dangerous commands
			if isCommandBlocked(msg.Command) {
				c.WriteJSON(fiber.Map{
					"type":    "command_result",
					"command": msg.Command,
					"output":  "Error: this command is restricted — use the dashboard buttons to control the server",
				})
				continue
			}

			// Send command via gRPC
			resp, err := client.SendCommand(grpcCtx, &agentpb.SendCommandRequest{
				ServerId: server.ID.String(),
				Command:  msg.Command,
			})
			output := ""
			if err != nil {
				output = "Error: " + err.Error()
			} else if resp != nil {
				output = resp.ErrorMessage
			}
			c.WriteJSON(fiber.Map{
				"type":    "command_result",
				"command": msg.Command,
				"output":  output,
			})
		}
	}
}
