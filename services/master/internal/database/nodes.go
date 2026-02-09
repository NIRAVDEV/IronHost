package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Node represents a remote server running the IronHost Agent
type Node struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	FQDN            string    `json:"fqdn"`
	Scheme          string    `json:"scheme"`
	GRPCPort        int       `json:"grpc_port"`
	MemoryTotal     int64     `json:"memory_total"`
	MemoryAllocated int64     `json:"memory_allocated"`
	DiskTotal       int64     `json:"disk_total"`
	DiskAllocated   int64     `json:"disk_allocated"`
	DaemonTokenHash string    `json:"-"`
	MaintenanceMode bool      `json:"maintenance_mode"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CreateNode creates a new node in the database
func (db *DB) CreateNode(ctx context.Context, name, fqdn, scheme string, grpcPort int, memoryTotal, diskTotal int64, daemonTokenHash string) (*Node, error) {
	node := &Node{
		ID:              uuid.New(),
		Name:            name,
		FQDN:            fqdn,
		Scheme:          scheme,
		GRPCPort:        grpcPort,
		MemoryTotal:     memoryTotal,
		DiskTotal:       diskTotal,
		DaemonTokenHash: daemonTokenHash,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO nodes (id, name, fqdn, scheme, grpc_port, memory_total, disk_total, daemon_token_hash, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, node.ID, node.Name, node.FQDN, node.Scheme, node.GRPCPort, node.MemoryTotal, node.DiskTotal, node.DaemonTokenHash, node.CreatedAt, node.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return node, nil
}

// GetNodeByID finds a node by ID
func (db *DB) GetNodeByID(ctx context.Context, id uuid.UUID) (*Node, error) {
	var node Node
	err := db.Pool.QueryRow(ctx, `
		SELECT id, name, fqdn, scheme, grpc_port, memory_total, memory_allocated, disk_total, disk_allocated, daemon_token_hash, maintenance_mode, created_at, updated_at
		FROM nodes WHERE id = $1
	`, id).Scan(&node.ID, &node.Name, &node.FQDN, &node.Scheme, &node.GRPCPort, &node.MemoryTotal, &node.MemoryAllocated, &node.DiskTotal, &node.DiskAllocated, &node.DaemonTokenHash, &node.MaintenanceMode, &node.CreatedAt, &node.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &node, nil
}

// ListNodes returns all nodes
func (db *DB) ListNodes(ctx context.Context) ([]*Node, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, name, fqdn, scheme, grpc_port, memory_total, memory_allocated, disk_total, disk_allocated, daemon_token_hash, maintenance_mode, created_at, updated_at
		FROM nodes ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []*Node
	for rows.Next() {
		var node Node
		if err := rows.Scan(&node.ID, &node.Name, &node.FQDN, &node.Scheme, &node.GRPCPort, &node.MemoryTotal, &node.MemoryAllocated, &node.DiskTotal, &node.DiskAllocated, &node.DaemonTokenHash, &node.MaintenanceMode, &node.CreatedAt, &node.UpdatedAt); err != nil {
			return nil, err
		}
		nodes = append(nodes, &node)
	}

	return nodes, nil
}

// UpdateNodeResources updates the allocated resources for a node
func (db *DB) UpdateNodeResources(ctx context.Context, id uuid.UUID, memoryAllocated, diskAllocated int64) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE nodes SET memory_allocated = $2, disk_allocated = $3, updated_at = $4 WHERE id = $1
	`, id, memoryAllocated, diskAllocated, time.Now())
	return err
}

// DeleteNode deletes a node by ID
func (db *DB) DeleteNode(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM nodes WHERE id = $1`, id)
	return err
}

// GetAddress returns the gRPC address for connecting to the node
func (node *Node) GetAddress() string {
	return fmt.Sprintf("%s:%d", node.FQDN, node.GRPCPort)
}
