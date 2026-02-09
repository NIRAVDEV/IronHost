# IronHost

A high-performance, distributed game server management platform built with Go and Next.js.

> **Custom Pterodactyl Alternative** - Built for production-grade Minecraft and game server hosting.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Service 1         │     │   Service 2         │     │   Service 3         │
│   Frontend          │────▶│   Master Control    │────▶│   Agent/Daemon      │
│   (Next.js 15)      │REST │   Plane (Go)        │gRPC │   (Go + Docker)     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                      │                           │
                                      ▼                           ▼
                                 PostgreSQL               Docker Containers
                                   Redis                  (Minecraft, etc.)
```

## Project Structure

```
IronHost/
├── services/
│   ├── master/              # Master Control Plane (Go + Fiber)
│   │   ├── cmd/master/      # Entry point
│   │   ├── internal/
│   │   │   ├── api/         # REST API handlers
│   │   │   ├── database/    # PostgreSQL connection
│   │   │   ├── grpc/        # gRPC client pool
│   │   │   └── models/      # Domain models
│   │   └── migrations/      # SQL schema
│   │
│   ├── agent/               # Agent Daemon (Go + Docker SDK)
│   │   ├── cmd/agent/       # Entry point
│   │   └── internal/
│   │       ├── docker/      # Docker SDK integration
│   │       └── grpc/        # gRPC server
│   │
│   └── frontend/            # Next.js 15 Frontend (TODO)
│
├── proto/                   # Protocol Buffer definitions
│   └── ironhost/v1/
│
├── deployments/             # Docker Compose configs
├── scripts/                 # Setup scripts
└── certs/                   # mTLS certificates (gitignored)
```

## Quick Start

### Prerequisites

- Go 1.22+
- Docker & Docker Compose
- PostgreSQL 16+
- protoc (Protocol Buffer compiler)

### 1. Generate mTLS Certificates

```bash
# On Linux/macOS
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh ./certs

# On Windows (use Git Bash or WSL)
bash scripts/generate-certs.sh ./certs
```

### 2. Generate Protobuf Code

```bash
bash scripts/generate-proto.sh
```

### 3. Start Development Stack

```bash
cd deployments
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Master Control Plane on port 3000
- Local Agent on port 8443

### 4. Build Services Manually

```bash
# Master
cd services/master
go mod tidy
go build -o ironhost-master ./cmd/master

# Agent
cd services/agent
go mod tidy
go build -o ironhost-agent ./cmd/agent
```

## Configuration

### Master Control Plane

| Flag | Default | Description |
|------|---------|-------------|
| `--http-port` | 3000 | HTTP API port |
| `--db-host` | localhost | PostgreSQL host |
| `--db-port` | 5432 | PostgreSQL port |
| `--db-user` | ironhost | Database user |
| `--db-password` | - | Database password |
| `--db-name` | ironhost | Database name |
| `--redis-addr` | localhost:6379 | Redis address |
| `--cert-dir` | /etc/ironhost/certs | mTLS certificates |

### Agent Daemon

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 8443 | gRPC server port |
| `--cert` | /etc/ironhost/certs/server.crt | TLS certificate |
| `--key` | /etc/ironhost/certs/server.key | TLS private key |
| `--ca` | /etc/ironhost/certs/ca.crt | CA certificate |
| `--data` | /var/lib/ironhost | Server data directory |
| `--node-id` | hostname | Unique node identifier |

## API Endpoints

### Nodes
- `GET /api/v1/nodes` - List all nodes
- `GET /api/v1/nodes/:id` - Get node details
- `POST /api/v1/nodes` - Register new node
- `GET /api/v1/nodes/:id/stats` - Get node resource stats

### Servers
- `GET /api/v1/servers` - List servers
- `POST /api/v1/servers` - Create server
- `POST /api/v1/servers/:id/start` - Start server
- `POST /api/v1/servers/:id/stop` - Stop server
- `POST /api/v1/servers/:id/command` - Send console command

### Allocations
- `GET /api/v1/allocations` - List port allocations
- `POST /api/v1/allocations` - Create allocations

## Docker Image Support

Default Minecraft image: `itzg/minecraft-server`

Server types via `TYPE` environment variable:
- `TYPE=VANILLA` - Vanilla Minecraft
- `TYPE=PAPER` - PaperMC 
- `TYPE=LEAF` - Leaf
- `TYPE=FORGE` - Minecraft Forge
- `TYPE=FABRIC` - Fabric

## Security

### mTLS Authentication

All Master ↔ Agent communication uses mutual TLS:
- Agents verify Master's client certificate
- Master verifies Agent's server certificate
- Both trust the same CA

### Certificate Distribution

| Service | Required Files |
|---------|---------------|
| Master | `ca.crt`, `client.crt`, `client.key` |
| Agent | `ca.crt`, `server.crt`, `server.key` |

## License

Proprietary - All Rights Reserved
