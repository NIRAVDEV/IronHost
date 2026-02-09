package grpc

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/ironhost/agent/internal/docker"
)

// AgentService implements the gRPC AgentService
type AgentService struct {
	UnimplementedAgentServiceServer
	nodeID    string
	dockerMgr *docker.Manager
	dataDir   string

	// Track container IDs by server ID
	containers map[string]string
	mu         sync.RWMutex
}

// NewAgentService creates a new agent service instance
func NewAgentService(nodeID string, dockerMgr *docker.Manager, dataDir string) *AgentService {
	return &AgentService{
		nodeID:     nodeID,
		dockerMgr:  dockerMgr,
		dataDir:    dataDir,
		containers: make(map[string]string),
	}
}

// RegisterAgentServiceServer registers the agent service with a gRPC server
func RegisterAgentServiceServer(s *grpc.Server, srv *AgentService) {
	// This would use the generated protobuf code
	// pb.RegisterAgentServiceServer(s, srv)
}

// CreateServer creates a new game server container
func (s *AgentService) CreateServer(ctx context.Context, req *CreateServerRequest) (*CreateServerResponse, error) {
	serverID := req.ServerId
	if serverID == "" {
		serverID = uuid.New().String()
	}

	// Build environment map from proto
	env := make(map[string]string)
	for _, e := range req.Environment {
		env[e.Key] = e.Value
	}

	// Get primary port from allocations
	port := 25565 // Default Minecraft port
	if len(req.Allocations) > 0 {
		port = int(req.Allocations[0].Port)
	}

	// Data directory for this server
	dataPath := fmt.Sprintf("%s/servers/%s", s.dataDir, serverID)

	// Create container config
	cfg := docker.ServerConfig{
		ServerID:    serverID,
		Name:        req.Name,
		Image:       req.DockerImage, // Defaults to itzg/minecraft-server in docker pkg
		MemoryMB:    req.Limits.MemoryMb,
		CPUPercent:  int(req.Limits.CpuPercent),
		Environment: env,
		Port:        port,
		DataPath:    dataPath,
	}

	// Pull the image first
	if err := s.dockerMgr.PullImage(ctx, cfg.Image); err != nil {
		return &CreateServerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("failed to pull image: %v", err),
		}, nil
	}

	// Create the container
	containerID, err := s.dockerMgr.CreateContainer(ctx, cfg)
	if err != nil {
		return &CreateServerResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("failed to create container: %v", err),
		}, nil
	}

	// Track the container
	s.mu.Lock()
	s.containers[serverID] = containerID
	s.mu.Unlock()

	return &CreateServerResponse{
		Success:     true,
		ContainerId: containerID,
	}, nil
}

// StartServer starts a stopped server container
func (s *AgentService) StartServer(ctx context.Context, req *ServerIdentifier) (*ServerActionResponse, error) {
	containerID, err := s.getContainerID(req.ServerId)
	if err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	if err := s.dockerMgr.StartContainer(ctx, containerID); err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &ServerActionResponse{Success: true}, nil
}

// StopServer stops a running server container
func (s *AgentService) StopServer(ctx context.Context, req *StopServerRequest) (*ServerActionResponse, error) {
	containerID, err := s.getContainerID(req.ServerId)
	if err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	timeout := 30
	if req.TimeoutSeconds > 0 {
		timeout = int(req.TimeoutSeconds)
	}

	if err := s.dockerMgr.StopContainer(ctx, containerID, timeout); err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &ServerActionResponse{Success: true}, nil
}

// RestartServer restarts a server container
func (s *AgentService) RestartServer(ctx context.Context, req *ServerIdentifier) (*ServerActionResponse, error) {
	containerID, err := s.getContainerID(req.ServerId)
	if err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	// Stop then start
	if err := s.dockerMgr.StopContainer(ctx, containerID, 30); err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	if err := s.dockerMgr.StartContainer(ctx, containerID); err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	return &ServerActionResponse{Success: true}, nil
}

// DeleteServer removes a server container
func (s *AgentService) DeleteServer(ctx context.Context, req *ServerIdentifier) (*ServerActionResponse, error) {
	containerID, err := s.getContainerID(req.ServerId)
	if err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	// Force remove the container
	if err := s.dockerMgr.RemoveContainer(ctx, containerID, true); err != nil {
		return &ServerActionResponse{Success: false, ErrorMessage: err.Error()}, nil
	}

	// Remove from tracking
	s.mu.Lock()
	delete(s.containers, req.ServerId)
	s.mu.Unlock()

	return &ServerActionResponse{Success: true}, nil
}

// GetServerStatus returns the current status of a server
func (s *AgentService) GetServerStatus(ctx context.Context, req *ServerIdentifier) (*ServerState, error) {
	containerID, err := s.getContainerID(req.ServerId)
	if err != nil {
		return &ServerState{
			ServerId: req.ServerId,
			Status:   ServerStatus_SERVER_STATUS_OFFLINE,
		}, nil
	}

	stats, err := s.dockerMgr.GetContainerStats(ctx, containerID)
	if err != nil {
		return &ServerState{
			ServerId: req.ServerId,
			Status:   ServerStatus_SERVER_STATUS_OFFLINE,
		}, nil
	}

	return &ServerState{
		ServerId:         req.ServerId,
		Status:           ServerStatus_SERVER_STATUS_RUNNING,
		MemoryUsageBytes: int64(stats.MemoryStats.Usage),
		CpuUsagePercent:  calculateCPUPercent(stats),
		LastUpdated:      timestamppb.Now(),
	}, nil
}

// ListServers returns all servers on this node
func (s *AgentService) ListServers(ctx context.Context, _ *emptypb.Empty) (*ListServersResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	servers := make([]*ServerState, 0, len(s.containers))
	for serverID := range s.containers {
		state, _ := s.GetServerStatus(ctx, &ServerIdentifier{ServerId: serverID})
		servers = append(servers, state)
	}

	return &ListServersResponse{Servers: servers}, nil
}

// StreamConsole streams server console output
func (s *AgentService) StreamConsole(req *ServerIdentifier, stream AgentService_StreamConsoleServer) error {
	containerID, err := s.getContainerID(req.ServerId)
	if err != nil {
		return err
	}

	ctx := stream.Context()

	// Create a pipe to capture logs
	pr, pw := io.Pipe()

	go func() {
		s.dockerMgr.StreamLogs(ctx, containerID, pw, pw)
		pw.Close()
	}()

	buf := make([]byte, 4096)
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			n, err := pr.Read(buf)
			if err != nil {
				return err
			}

			output := &ConsoleOutput{
				ServerId:  req.ServerId,
				Line:      string(buf[:n]),
				Timestamp: time.Now().Unix(),
			}

			if err := stream.Send(output); err != nil {
				return err
			}
		}
	}
}

// SendCommand sends a command to the server console
func (s *AgentService) SendCommand(ctx context.Context, req *SendCommandRequest) (*emptypb.Empty, error) {
	containerID, err := s.getContainerID(req.ServerId)
	if err != nil {
		return nil, err
	}

	if err := s.dockerMgr.SendCommand(ctx, containerID, req.Command); err != nil {
		return nil, err
	}

	return &emptypb.Empty{}, nil
}

// GetNodeStats returns resource stats for this node
func (s *AgentService) GetNodeStats(ctx context.Context, _ *emptypb.Empty) (*NodeStats, error) {
	// TODO: Implement proper system resource stats
	return &NodeStats{
		NodeId:            s.nodeID,
		RunningContainers: int32(len(s.containers)),
	}, nil
}

// Ping responds to health checks
func (s *AgentService) Ping(ctx context.Context, _ *emptypb.Empty) (*PingResponse, error) {
	return &PingResponse{
		NodeId:    s.nodeID,
		Version:   "0.1.0",
		Timestamp: time.Now().Unix(),
	}, nil
}

// Helper to get container ID from server ID
func (s *AgentService) getContainerID(serverID string) (string, error) {
	s.mu.RLock()
	containerID, exists := s.containers[serverID]
	s.mu.RUnlock()

	if !exists {
		// Try to find by label
		ctx := context.Background()
		container, err := s.dockerMgr.GetContainerByServerID(ctx, serverID)
		if err != nil {
			return "", fmt.Errorf("server not found: %s", serverID)
		}

		s.mu.Lock()
		s.containers[serverID] = container.ID
		s.mu.Unlock()

		return container.ID, nil
	}

	return containerID, nil
}

// Helper to calculate CPU percentage from stats
func calculateCPUPercent(stats interface{}) float64 {
	// TODO: Implement proper CPU calculation
	return 0.0
}

// Proto message types (placeholders - would be generated from .proto)
type CreateServerRequest struct {
	ServerId    string
	Name        string
	DockerImage string
	Limits      *ResourceLimits
	Allocations []*Allocation
	Environment []*EnvVar
}

type CreateServerResponse struct {
	Success      bool
	ContainerId  string
	ErrorMessage string
}

type ServerIdentifier struct {
	ServerId string
}

type StopServerRequest struct {
	ServerId       string
	TimeoutSeconds int32
}

type ServerActionResponse struct {
	Success      bool
	ErrorMessage string
}

type ResourceLimits struct {
	MemoryMb   int64
	DiskMb     int64
	CpuPercent int32
}

type Allocation struct {
	Id        string
	IpAddress string
	Port      int32
	IsPrimary bool
}

type EnvVar struct {
	Key   string
	Value string
}

type ServerStatus int32

const (
	ServerStatus_SERVER_STATUS_UNSPECIFIED ServerStatus = 0
	ServerStatus_SERVER_STATUS_INSTALLING  ServerStatus = 1
	ServerStatus_SERVER_STATUS_OFFLINE     ServerStatus = 2
	ServerStatus_SERVER_STATUS_STARTING    ServerStatus = 3
	ServerStatus_SERVER_STATUS_RUNNING     ServerStatus = 4
	ServerStatus_SERVER_STATUS_STOPPING    ServerStatus = 5
	ServerStatus_SERVER_STATUS_SUSPENDED   ServerStatus = 6
)

type ServerState struct {
	ServerId         string
	Status           ServerStatus
	MemoryUsageBytes int64
	DiskUsageBytes   int64
	CpuUsagePercent  float64
	UptimeSeconds    int64
	LastUpdated      *timestamppb.Timestamp
}

type ListServersResponse struct {
	Servers []*ServerState
}

type ConsoleOutput struct {
	ServerId  string
	Line      string
	Timestamp int64
	IsError   bool
}

type SendCommandRequest struct {
	ServerId string
	Command  string
}

type NodeStats struct {
	NodeId               string
	TotalMemoryBytes     int64
	AvailableMemoryBytes int64
	TotalDiskBytes       int64
	AvailableDiskBytes   int64
	CpuUsagePercent      float64
	RunningContainers    int32
	UptimeSeconds        int64
}

type PingResponse struct {
	NodeId    string
	Version   string
	Timestamp int64
}

type AgentService_StreamConsoleServer interface {
	Send(*ConsoleOutput) error
	Context() context.Context
}

type UnimplementedAgentServiceServer struct{}
