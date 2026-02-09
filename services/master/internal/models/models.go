package models

import (
	"time"

	"github.com/google/uuid"
)

// ServerStatus represents the current state of a game server
type ServerStatus string

const (
	StatusInstalling ServerStatus = "installing"
	StatusOffline    ServerStatus = "offline"
	StatusStarting   ServerStatus = "starting"
	StatusRunning    ServerStatus = "running"
	StatusStopping   ServerStatus = "stopping"
	StatusSuspended  ServerStatus = "suspended"
)

// Node represents a remote server running the IronHost Agent daemon
type Node struct {
	ID              uuid.UUID `json:"id" db:"id"`
	Name            string    `json:"name" db:"name"`
	FQDN            string    `json:"fqdn" db:"fqdn"`                         // Fully Qualified Domain Name
	Scheme          string    `json:"scheme" db:"scheme"`                     // http or https
	MemoryTotal     int64     `json:"memory_total" db:"memory_total"`         // Total RAM in MB
	MemoryAllocated int64     `json:"memory_allocated" db:"memory_allocated"` // Allocated RAM in MB
	DiskTotal       int64     `json:"disk_total" db:"disk_total"`             // Total disk in MB
	DiskAllocated   int64     `json:"disk_allocated" db:"disk_allocated"`     // Allocated disk in MB
	DaemonTokenHash string    `json:"-" db:"daemon_token_hash"`               // Hashed authentication token
	MaintenanceMode bool      `json:"maintenance_mode" db:"maintenance_mode"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`

	// Relationships (not stored in DB, populated via joins)
	Allocations []Allocation `json:"allocations,omitempty" db:"-"`
	Servers     []Server     `json:"servers,omitempty" db:"-"`
}

// Allocation represents a port allocation on a node
type Allocation struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	NodeID    uuid.UUID  `json:"node_id" db:"node_id"`
	ServerID  *uuid.UUID `json:"server_id,omitempty" db:"server_id"` // Nullable - unassigned if nil
	IPAddress string     `json:"ip_address" db:"ip_address"`
	Port      int        `json:"port" db:"port"`
	Notes     string     `json:"notes,omitempty" db:"notes"`
	Assigned  bool       `json:"assigned" db:"assigned"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

// Server represents a game server instance (e.g., Minecraft server)
type Server struct {
	ID                  uuid.UUID         `json:"id" db:"id"`
	UserID              uuid.UUID         `json:"user_id" db:"user_id"`
	NodeID              uuid.UUID         `json:"node_id" db:"node_id"`
	Name                string            `json:"name" db:"name"`
	Description         string            `json:"description,omitempty" db:"description"`
	MemoryLimit         int64             `json:"memory_limit" db:"memory_limit"` // RAM limit in MB
	DiskLimit           int64             `json:"disk_limit" db:"disk_limit"`     // Disk limit in MB
	CPULimit            int               `json:"cpu_limit" db:"cpu_limit"`       // CPU percentage (100 = 1 core)
	DockerImage         string            `json:"docker_image" db:"docker_image"` // e.g., itzg/minecraft-server
	Status              ServerStatus      `json:"status" db:"status"`
	PrimaryAllocationID *uuid.UUID        `json:"primary_allocation_id" db:"primary_allocation_id"`
	Environment         map[string]string `json:"environment" db:"environment"` // JSONB - includes TYPE for server type
	CreatedAt           time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at" db:"updated_at"`

	// Runtime state (not stored in DB, fetched from Agent)
	ContainerID string `json:"container_id,omitempty" db:"-"`

	// Relationships
	Node              *Node        `json:"node,omitempty" db:"-"`
	Allocations       []Allocation `json:"allocations,omitempty" db:"-"`
	PrimaryAllocation *Allocation  `json:"primary_allocation,omitempty" db:"-"`
}

// User represents a platform user who owns servers
type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"` // Never expose in JSON
	Username     string    `json:"username" db:"username"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`

	// Relationships
	Servers []Server `json:"servers,omitempty" db:"-"`
}

// ServerCreateRequest is the API request body for creating a new server
type ServerCreateRequest struct {
	Name        string            `json:"name" validate:"required,min=3,max=100"`
	NodeID      uuid.UUID         `json:"node_id" validate:"required"`
	MemoryLimit int64             `json:"memory_limit" validate:"required,min=512"` // Minimum 512MB
	DiskLimit   int64             `json:"disk_limit" validate:"required,min=1024"`  // Minimum 1GB
	CPULimit    int               `json:"cpu_limit" validate:"min=25,max=400"`      // 25% to 4 cores
	DockerImage string            `json:"docker_image"`                             // Optional, defaults to itzg/minecraft-server
	ServerType  string            `json:"server_type"`                              // e.g., LEAF, PAPER, VANILLA
	Environment map[string]string `json:"environment"`                              // Additional env vars
}

// DefaultMinecraftImage is the default Docker image for Minecraft servers
const DefaultMinecraftImage = "itzg/minecraft-server"

// NewServerFromRequest creates a Server from API request with defaults
func NewServerFromRequest(req ServerCreateRequest, userID uuid.UUID) *Server {
	image := req.DockerImage
	if image == "" {
		image = DefaultMinecraftImage
	}

	env := req.Environment
	if env == nil {
		env = make(map[string]string)
	}

	// Set server type if provided (e.g., TYPE=LEAF, TYPE=PAPER)
	if req.ServerType != "" {
		env["TYPE"] = req.ServerType
	}

	// Required for itzg/minecraft-server
	env["EULA"] = "TRUE"

	cpuLimit := req.CPULimit
	if cpuLimit == 0 {
		cpuLimit = 100 // Default to 1 core
	}

	return &Server{
		ID:          uuid.New(),
		UserID:      userID,
		NodeID:      req.NodeID,
		Name:        req.Name,
		MemoryLimit: req.MemoryLimit,
		DiskLimit:   req.DiskLimit,
		CPULimit:    cpuLimit,
		DockerImage: image,
		Status:      StatusInstalling,
		Environment: env,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}
