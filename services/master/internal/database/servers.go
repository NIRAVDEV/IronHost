package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/ironhost/master/internal/models"
)

// CreateServer creates a new server record
func (db *DB) CreateServer(ctx context.Context, server *models.Server) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO servers (
			id, user_id, node_id, name, description, memory_limit, disk_limit, cpu_limit, 
			docker_image, status, environment, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		server.ID, server.UserID, server.NodeID, server.Name, server.Description,
		server.MemoryLimit, server.DiskLimit, server.CPULimit, server.DockerImage,
		server.Status, server.Environment, server.CreatedAt, server.UpdatedAt,
	)
	return err
}

// GetServer retrieves a server by ID
func (db *DB) GetServer(ctx context.Context, id uuid.UUID) (*models.Server, error) {
	var server models.Server
	err := db.Pool.QueryRow(ctx, `
		SELECT id, user_id, node_id, name, description, memory_limit, disk_limit, cpu_limit,
		       docker_image, status, primary_allocation_id, environment, created_at, updated_at
		FROM servers WHERE id = $1
	`, id).Scan(
		&server.ID, &server.UserID, &server.NodeID, &server.Name, &server.Description,
		&server.MemoryLimit, &server.DiskLimit, &server.CPULimit, &server.DockerImage,
		&server.Status, &server.PrimaryAllocationID, &server.Environment, &server.CreatedAt, &server.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Fetch Node for this server
	node, err := db.GetNodeByID(ctx, server.NodeID)
	if err == nil {
		server.Node = &models.Node{
			ID:              node.ID,
			Name:            node.Name,
			FQDN:            node.FQDN,
			DaemonTokenHash: node.DaemonTokenHash,
		}
	}

	return &server, nil
}

// UpdateServerStatus updates the status of a server
func (db *DB) UpdateServerStatus(ctx context.Context, id uuid.UUID, status models.ServerStatus) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE servers SET status = $2, updated_at = $3 WHERE id = $1
	`, id, status, time.Now())
	return err
}

// UpdateServerContainerID sets the container ID
func (db *DB) UpdateServerContainerID(ctx context.Context, id uuid.UUID, containerID string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE servers SET container_id = $2, updated_at = $3 WHERE id = $1
	`, id, containerID, time.Now())
	return err
}

// DeleteServer removes a server
func (db *DB) DeleteServer(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM servers WHERE id = $1`, id)
	return err
}

// AssignAllocation finds a free port on the node and assigns it to the server
// This is a simplified "Just-in-Time" allocation strategy
func (db *DB) AssignAllocation(ctx context.Context, serverID uuid.UUID, nodeID uuid.UUID) (*models.Allocation, error) {
	// Start transaction
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Simple strategy: Try ports 25565 to 25600 until one is not in allocations table for this node
	startPort := 25565
	endPort := 25600
	var assignedPort int

	for port := startPort; port <= endPort; port++ {
		var exists bool
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM allocations WHERE node_id = $1 AND port = $2)`, nodeID, port).Scan(&exists)
		if err != nil {
			return nil, err
		}
		if !exists {
			assignedPort = port
			break
		}
	}

	if assignedPort == 0 {
		return nil, fmt.Errorf("no free ports available in range %d-%d", startPort, endPort)
	}

	// Get Node IP (FQDN) to use in allocation
	var nodeFQDN string
	err = tx.QueryRow(ctx, `SELECT fqdn FROM nodes WHERE id = $1`, nodeID).Scan(&nodeFQDN)
	if err != nil {
		return nil, err
	}

	// Create allocation
	allocation := &models.Allocation{
		ID:        uuid.New(),
		NodeID:    nodeID,
		ServerID:  &serverID,
		IPAddress: nodeFQDN, // Use Node FQDN/IP as allocation IP
		Port:      assignedPort,
		Assigned:  true,
		CreatedAt: time.Now(),
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO allocations (id, node_id, server_id, ip_address, port, assigned, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, allocation.ID, allocation.NodeID, allocation.ServerID, allocation.IPAddress, allocation.Port, allocation.Assigned, allocation.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Link server to primary allocation
	_, err = tx.Exec(ctx, `
		UPDATE servers SET primary_allocation_id = $1 WHERE id = $2
	`, allocation.ID, serverID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return allocation, nil
}

// ListServers returns all servers
func (db *DB) ListServers(ctx context.Context) ([]*models.Server, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT s.id, s.name, s.status, s.docker_image, s.memory_limit, s.created_at, n.name as node_name
		FROM servers s
		JOIN nodes n ON s.node_id = n.id
		ORDER BY s.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []*models.Server
	for rows.Next() {
		var s models.Server
		var nodeName string
		if err := rows.Scan(&s.ID, &s.Name, &s.Status, &s.DockerImage, &s.MemoryLimit, &s.CreatedAt, &nodeName); err != nil {
			return nil, err
		}
		// Attach partial node info
		s.Node = &models.Node{Name: nodeName}
		servers = append(servers, &s)
	}
	return servers, nil
}
