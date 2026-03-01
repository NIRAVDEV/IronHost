package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"google.golang.org/grpc/metadata"

	"github.com/ironhost/master/internal/database"
	mastergrpc "github.com/ironhost/master/internal/grpc"
	agentpb "github.com/ironhost/master/internal/grpc/ironhost/v1"
)

// FileHandler handles file management API requests
type FileHandler struct {
	db       *database.DB
	grpcPool *mastergrpc.ClientPool
}

// NewFileHandler creates a new file handler
func NewFileHandler(db *database.DB, grpcPool *mastergrpc.ClientPool) *FileHandler {
	return &FileHandler{db: db, grpcPool: grpcPool}
}

// sendFileCommand sends a __file: prefixed command to the Agent and returns the parsed JSON response
func (h *FileHandler) sendFileCommand(c *fiber.Ctx, serverID uuid.UUID, operation, body string) (map[string]interface{}, error) {
	userID := c.Locals("userID").(uuid.UUID)

	server, err := h.db.GetServer(c.Context(), serverID)
	if err != nil || server.UserID != userID {
		return nil, fiber.NewError(fiber.StatusNotFound, "server not found")
	}

	node, err := h.db.GetNodeByID(c.Context(), server.NodeID)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "node not found")
	}

	conn, err := h.grpcPool.GetClient(node.GetAddress(), node.Scheme == "http")
	if err != nil {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "failed to connect to agent")
	}

	client := agentpb.NewAgentServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(c.Context(), "authorization", "Bearer "+node.DaemonTokenHash)

	command := fmt.Sprintf("__file:%s:%s", operation, body)
	resp, err := client.SendCommand(ctx, &agentpb.SendCommandRequest{
		ServerId: server.ID.String(),
		Command:  command,
	})
	if err != nil {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "file operation failed: "+err.Error())
	}

	// Parse JSON response from Agent
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(resp.ErrorMessage), &result); err != nil {
		log.Printf("File operation response parse error: %v, raw: %s", err, resp.ErrorMessage)
		return nil, fiber.NewError(fiber.StatusInternalServerError, "invalid response from agent")
	}

	// Check for errors in the response
	if errMsg, ok := result["error"].(string); ok && errMsg != "" {
		return nil, fiber.NewError(fiber.StatusBadRequest, errMsg)
	}

	return result, nil
}

// ListFiles lists files in a server's directory
// GET /servers/:id/files?path=
func (h *FileHandler) ListFiles(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	path := c.Query("path", "")
	result, err := h.sendFileCommand(c, id, "list", path)
	if err != nil {
		return err
	}

	return c.JSON(result)
}

// ReadFile reads a file's content
// GET /servers/:id/files/content?path=
func (h *FileHandler) ReadFile(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	path := c.Query("path", "")
	if path == "" {
		return fiber.NewError(fiber.StatusBadRequest, "path is required")
	}

	result, err := h.sendFileCommand(c, id, "read", path)
	if err != nil {
		return err
	}

	return c.JSON(result)
}

// WriteFile writes content to a file
// PUT /servers/:id/files/content
func (h *FileHandler) WriteFile(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	body, _ := json.Marshal(req)
	result, err := h.sendFileCommand(c, id, "write", string(body))
	if err != nil {
		return err
	}

	return c.JSON(result)
}

// DeleteFile deletes a file or directory
// DELETE /servers/:id/files?path=
func (h *FileHandler) DeleteFile(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	path := c.Query("path", "")
	if path == "" {
		return fiber.NewError(fiber.StatusBadRequest, "path is required")
	}

	result, err := h.sendFileCommand(c, id, "delete", path)
	if err != nil {
		return err
	}

	return c.JSON(result)
}

// RenameFile renames a file or directory
// POST /servers/:id/files/rename
func (h *FileHandler) RenameFile(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid server ID")
	}

	var req struct {
		OldPath string `json:"old_path"`
		NewPath string `json:"new_path"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	body, _ := json.Marshal(req)
	result, err := h.sendFileCommand(c, id, "rename", string(body))
	if err != nil {
		return err
	}

	return c.JSON(result)
}

// Ensure imports are used
var _ = context.Background
