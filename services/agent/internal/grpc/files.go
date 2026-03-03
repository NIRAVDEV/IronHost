package grpc

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// ── File Management ──
// These methods operate on the host filesystem at the server's data directory.
// The data directory is resolved by inspecting the Docker container's /data mount,
// falling back to {dataDir}/servers/{serverID} if no container is found.
// They are called by the Agent's SendCommand handler when the command starts
// with the special "__file:" prefix.

// FileInfo represents a file or directory entry
type FileInfo struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDirectory bool   `json:"is_directory"`
	Size        int64  `json:"size"`
	ModifiedAt  int64  `json:"modified_at"`
}

// FileResponse is the generic response for file operations
type FileResponse struct {
	Success     bool       `json:"success"`
	Error       string     `json:"error,omitempty"`
	Files       []FileInfo `json:"files,omitempty"`
	Content     string     `json:"content,omitempty"`
	FileName    string     `json:"file_name,omitempty"`
	FileSize    int64      `json:"file_size,omitempty"`
	CurrentPath string     `json:"current_path,omitempty"`
}

// getServerRoot returns the host-side root directory for a server's files.
// It first tries to resolve the path from the Docker container's /data mount,
// falling back to {dataDir}/servers/{serverID}.
func (s *AgentService) getServerRoot(serverID string) string {
	ctx := context.Background()
	if dataPath, err := s.dockerMgr.GetContainerDataPath(ctx, serverID); err == nil {
		log.Printf("📁 getServerRoot: resolved from Docker mount: %q", dataPath)
		return dataPath
	}

	// Fallback to computed path
	fallback := filepath.Join(s.dataDir, "servers", serverID)
	log.Printf("📁 getServerRoot: using fallback path: %q", fallback)
	return fallback
}

// resolveServerPath returns the absolute path within a server's data directory.
// It prevents path traversal attacks.
func (s *AgentService) resolveServerPath(serverID, relPath string) (string, error) {
	if strings.ContainsAny(serverID, "/\\..") {
		return "", fmt.Errorf("invalid server ID")
	}

	serverRoot := s.getServerRoot(serverID)
	target := filepath.Join(serverRoot, filepath.Clean("/"+relPath))

	absTarget, err := filepath.Abs(target)
	if err != nil {
		return "", fmt.Errorf("invalid path")
	}
	absRoot, err := filepath.Abs(serverRoot)
	if err != nil {
		return "", fmt.Errorf("invalid server root")
	}

	log.Printf("📁 resolveServerPath: serverRoot=%q absRoot=%q absTarget=%q", serverRoot, absRoot, absTarget)

	if !strings.HasPrefix(absTarget, absRoot) {
		return "", fmt.Errorf("access denied: path traversal")
	}

	return absTarget, nil
}

// HandleFileCommand processes a file management command and returns JSON response.
// Command format: "__file:<operation>" with JSON body.
// Operations: list, read, write, delete, rename
func (s *AgentService) HandleFileCommand(serverID, operation, body string) string {
	log.Printf("📂 HandleFileCommand: serverID=%q op=%q body=%q", serverID, operation, body)
	var resp FileResponse

	switch operation {
	case "list":
		resp = s.fileList(serverID, body)
	case "read":
		resp = s.fileRead(serverID, body)
	case "write":
		resp = s.fileWrite(serverID, body)
	case "delete":
		resp = s.fileDelete(serverID, body)
	case "rename":
		resp = s.fileRename(serverID, body)
	default:
		resp = FileResponse{Error: "unknown file operation: " + operation}
	}

	data, _ := json.Marshal(resp)
	log.Printf("📂 HandleFileCommand result: %s", string(data))
	return string(data)
}

func (s *AgentService) fileList(serverID, pathStr string) FileResponse {
	dirPath, err := s.resolveServerPath(serverID, pathStr)
	if err != nil {
		return FileResponse{Error: err.Error()}
	}

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Auto-create server data directory if it doesn't exist yet
			if mkErr := os.MkdirAll(dirPath, 0755); mkErr != nil {
				return FileResponse{Error: "failed to create directory: " + mkErr.Error()}
			}
			// Return empty listing for newly created directory
			return FileResponse{
				Success:     true,
				Files:       []FileInfo{},
				CurrentPath: filepath.ToSlash(pathStr),
			}
		}
		return FileResponse{Error: "failed to read directory: " + err.Error()}
	}

	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		relPath := filepath.Join(pathStr, entry.Name())
		files = append(files, FileInfo{
			Name:        entry.Name(),
			Path:        filepath.ToSlash(relPath),
			IsDirectory: entry.IsDir(),
			Size:        info.Size(),
			ModifiedAt:  info.ModTime().Unix(),
		})
	}

	return FileResponse{
		Success:     true,
		Files:       files,
		CurrentPath: filepath.ToSlash(pathStr),
	}
}

func (s *AgentService) fileRead(serverID, pathStr string) FileResponse {
	filePath, err := s.resolveServerPath(serverID, pathStr)
	if err != nil {
		return FileResponse{Error: err.Error()}
	}

	info, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return FileResponse{Error: "file not found"}
		}
		return FileResponse{Error: "failed to stat file: " + err.Error()}
	}

	if info.IsDir() {
		return FileResponse{Error: "path is a directory"}
	}

	// 1MB limit
	if info.Size() > 1024*1024 {
		return FileResponse{Error: "file too large (max 1MB)"}
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return FileResponse{Error: "failed to read file: " + err.Error()}
	}

	return FileResponse{
		Success:  true,
		Content:  string(content),
		FileName: filepath.Base(filePath),
		FileSize: info.Size(),
	}
}

func (s *AgentService) fileWrite(serverID, bodyJSON string) FileResponse {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal([]byte(bodyJSON), &req); err != nil {
		return FileResponse{Error: "invalid request body"}
	}

	filePath, err := s.resolveServerPath(serverID, req.Path)
	if err != nil {
		return FileResponse{Error: err.Error()}
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return FileResponse{Error: "failed to create directory: " + err.Error()}
	}

	if err := os.WriteFile(filePath, []byte(req.Content), 0644); err != nil {
		return FileResponse{Error: "failed to write file: " + err.Error()}
	}

	return FileResponse{Success: true}
}

func (s *AgentService) fileDelete(serverID, pathStr string) FileResponse {
	filePath, err := s.resolveServerPath(serverID, pathStr)
	if err != nil {
		return FileResponse{Error: err.Error()}
	}

	serverRoot := filepath.Join(s.dataDir, "servers", serverID)
	absRoot, _ := filepath.Abs(serverRoot)
	absTarget, _ := filepath.Abs(filePath)
	if absTarget == absRoot {
		return FileResponse{Error: "cannot delete server root directory"}
	}

	if err := os.RemoveAll(filePath); err != nil {
		return FileResponse{Error: "failed to delete: " + err.Error()}
	}

	return FileResponse{Success: true}
}

func (s *AgentService) fileRename(serverID, bodyJSON string) FileResponse {
	var req struct {
		OldPath string `json:"old_path"`
		NewPath string `json:"new_path"`
	}
	if err := json.Unmarshal([]byte(bodyJSON), &req); err != nil {
		return FileResponse{Error: "invalid request body"}
	}

	oldPath, err := s.resolveServerPath(serverID, req.OldPath)
	if err != nil {
		return FileResponse{Error: "invalid old path: " + err.Error()}
	}
	newPath, err := s.resolveServerPath(serverID, req.NewPath)
	if err != nil {
		return FileResponse{Error: "invalid new path: " + err.Error()}
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		return FileResponse{Error: "failed to rename: " + err.Error()}
	}

	return FileResponse{Success: true}
}
