package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Config holds database connection configuration
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	MaxConns int32
}

// DB wraps the PostgreSQL connection pool
type DB struct {
	Pool *pgxpool.Pool
}

// NewConnection creates a new database connection pool from config
func NewConnection(cfg Config) (*DB, error) {
	if cfg.MaxConns == 0 {
		cfg.MaxConns = 10
	}

	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=prefer",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database,
	)

	return NewConnectionFromURL(dsn, cfg.MaxConns)
}

// NewConnectionFromURL creates a connection pool from a database URL (for Supabase)
func NewConnectionFromURL(databaseURL string, maxConns int32) (*DB, error) {
	if maxConns == 0 {
		maxConns = 10
	}

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	poolConfig.MaxConns = maxConns
	poolConfig.MinConns = 2
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{Pool: pool}, nil
}

// Close closes the database connection pool
func (db *DB) Close() {
	db.Pool.Close()
}

// Health checks if the database is reachable
func (db *DB) Health(ctx context.Context) error {
	return db.Pool.Ping(ctx)
}
