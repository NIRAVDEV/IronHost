package docker

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

// DefaultMinecraftImage is the default image for Minecraft servers
const DefaultMinecraftImage = "itzg/minecraft-server"

// ServerConfig holds the configuration for creating a game server container
type ServerConfig struct {
	ServerID    string            // Unique server identifier
	Name        string            // Human-readable name
	Image       string            // Docker image (defaults to itzg/minecraft-server)
	MemoryMB    int64             // Memory limit in MB
	CPUPercent  int               // CPU limit as percentage (100 = 1 core)
	Environment map[string]string // Environment variables (includes TYPE for server type)
	Port        int               // Primary game port
	DataPath    string            // Host path for persistent data
}

// Manager handles Docker operations for game server containers
type Manager struct {
	client *client.Client
}

// NewManager creates a new Docker manager instance
func NewManager() (*Manager, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}
	return &Manager{client: cli}, nil
}

// Close closes the Docker client connection
func (m *Manager) Close() error {
	return m.client.Close()
}

// PullImage pulls a Docker image from registry
// Supports custom images or defaults to itzg/minecraft-server
func (m *Manager) PullImage(ctx context.Context, imageName string) error {
	if imageName == "" {
		imageName = DefaultMinecraftImage
	}

	reader, err := m.client.ImagePull(ctx, imageName, types.ImagePullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull image %s: %w", imageName, err)
	}
	defer reader.Close()

	// Consume the output to complete the pull
	_, err = io.Copy(io.Discard, reader)
	if err != nil {
		return fmt.Errorf("failed to complete image pull: %w", err)
	}

	return nil
}

// CreateContainer creates a new game server container with specified configuration
// Uses itzg/minecraft-server with TYPE env var for server type (e.g., TYPE=LEAF, TYPE=PAPER)
func (m *Manager) CreateContainer(ctx context.Context, cfg ServerConfig) (string, error) {
	if cfg.Image == "" {
		cfg.Image = DefaultMinecraftImage
	}

	// Build environment variables slice
	env := make([]string, 0, len(cfg.Environment)+2)

	// Always accept EULA for Minecraft servers
	env = append(env, "EULA=TRUE")

	// Set memory for JVM (itzg/minecraft-server uses MEMORY env var)
	env = append(env, fmt.Sprintf("MEMORY=%dM", cfg.MemoryMB))

	// Add user-provided environment variables
	// This includes TYPE for server type (e.g., TYPE=LEAF, TYPE=PAPER, TYPE=VANILLA)
	for key, value := range cfg.Environment {
		env = append(env, fmt.Sprintf("%s=%s", key, value))
	}

	// Port mapping: expose the game port
	exposedPort := nat.Port(fmt.Sprintf("%d/tcp", cfg.Port))
	portBindings := nat.PortMap{
		"25565/tcp": []nat.PortBinding{
			{
				HostIP:   "0.0.0.0",
				HostPort: fmt.Sprintf("%d", cfg.Port),
			},
		},
	}

	// Container configuration
	containerConfig := &container.Config{
		Image: cfg.Image,
		Env:   env,
		ExposedPorts: nat.PortSet{
			exposedPort: struct{}{},
		},
		Labels: map[string]string{
			"ironhost.server.id":   cfg.ServerID,
			"ironhost.server.name": cfg.Name,
			"ironhost.managed":     "true",
		},
		Tty:          true,
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		OpenStdin:    true,
	}

	// Host configuration with resource limits
	hostConfig := &container.HostConfig{
		PortBindings: portBindings,
		Resources: container.Resources{
			Memory:     cfg.MemoryMB * 1024 * 1024,   // Convert MB to bytes
			MemorySwap: cfg.MemoryMB * 1024 * 1024,   // Same as memory (no swap)
			CPUPeriod:  100000,                       // 100ms period
			CPUQuota:   int64(cfg.CPUPercent) * 1000, // CPU quota based on percentage
		},
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeBind,
				Source: cfg.DataPath,
				Target: "/data",
			},
		},
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
	}

	// Network configuration
	networkConfig := &network.NetworkingConfig{}

	// Create the container
	containerName := fmt.Sprintf("ironhost-%s", cfg.ServerID)
	resp, err := m.client.ContainerCreate(
		ctx,
		containerConfig,
		hostConfig,
		networkConfig,
		nil, // platform
		containerName,
	)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	return resp.ID, nil
}

// StartContainer starts an existing container
func (m *Manager) StartContainer(ctx context.Context, containerID string) error {
	err := m.client.ContainerStart(ctx, containerID, container.StartOptions{})
	if err != nil {
		return fmt.Errorf("failed to start container %s: %w", containerID, err)
	}
	return nil
}

// StopContainer stops a running container with graceful timeout
func (m *Manager) StopContainer(ctx context.Context, containerID string, timeoutSeconds int) error {
	timeout := time.Duration(timeoutSeconds) * time.Second
	timeoutInt := int(timeout.Seconds())

	err := m.client.ContainerStop(ctx, containerID, container.StopOptions{
		Timeout: &timeoutInt,
	})
	if err != nil {
		return fmt.Errorf("failed to stop container %s: %w", containerID, err)
	}
	return nil
}

// RemoveContainer removes a container (must be stopped first)
func (m *Manager) RemoveContainer(ctx context.Context, containerID string, force bool) error {
	err := m.client.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         force,
		RemoveVolumes: false, // Preserve data volumes
	})
	if err != nil {
		return fmt.Errorf("failed to remove container %s: %w", containerID, err)
	}
	return nil
}

// GetContainerStats returns resource usage stats for a container
func (m *Manager) GetContainerStats(ctx context.Context, containerID string) (*types.StatsJSON, error) {
	resp, err := m.client.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get stats for container %s: %w", containerID, err)
	}
	defer resp.Body.Close()

	var stats types.StatsJSON
	if err := decodeStats(resp.Body, &stats); err != nil {
		return nil, err
	}

	return &stats, nil
}

// StreamLogs streams container logs to the provided writer
func (m *Manager) StreamLogs(ctx context.Context, containerID string, stdout, stderr io.Writer) error {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "100", // Start with last 100 lines
		Timestamps: true,
	}

	reader, err := m.client.ContainerLogs(ctx, containerID, options)
	if err != nil {
		return fmt.Errorf("failed to stream logs: %w", err)
	}
	defer reader.Close()

	// Docker multiplexes stdout/stderr in the stream
	_, err = stdcopy(stdout, stderr, reader)
	return err
}

// SendCommand sends a command to the container's stdin (e.g., Minecraft console command)
func (m *Manager) SendCommand(ctx context.Context, containerID string, command string) error {
	execConfig := types.ExecConfig{
		Cmd:          []string{"rcon-cli", command},
		AttachStdout: true,
		AttachStderr: true,
	}

	execID, err := m.client.ContainerExecCreate(ctx, containerID, execConfig)
	if err != nil {
		return fmt.Errorf("failed to create exec: %w", err)
	}

	err = m.client.ContainerExecStart(ctx, execID.ID, types.ExecStartCheck{})
	if err != nil {
		return fmt.Errorf("failed to start exec: %w", err)
	}

	return nil
}

// GetContainerByServerID finds a container by IronHost server ID label
func (m *Manager) GetContainerByServerID(ctx context.Context, serverID string) (*types.Container, error) {
	containers, err := m.client.ContainerList(ctx, container.ListOptions{
		All: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	for _, c := range containers {
		if c.Labels["ironhost.server.id"] == serverID {
			return &c, nil
		}
	}

	return nil, fmt.Errorf("container not found for server: %s", serverID)
}

// Helper function placeholders - implement with proper imports
func decodeStats(reader io.Reader, stats *types.StatsJSON) error {
	// Decode JSON stats from reader
	return nil
}

func stdcopy(stdout, stderr io.Writer, reader io.Reader) (int64, error) {
	// Use github.com/docker/docker/pkg/stdcopy.StdCopy
	return io.Copy(stdout, reader)
}
