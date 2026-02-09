-- IronHost Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nodes table (remote servers running the Agent)
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    fqdn VARCHAR(255) NOT NULL,
    scheme VARCHAR(10) DEFAULT 'https',
    grpc_port INTEGER DEFAULT 8443,
    memory_total INTEGER NOT NULL,        -- in MB
    memory_allocated INTEGER DEFAULT 0,
    disk_total INTEGER NOT NULL,          -- in MB  
    disk_allocated INTEGER DEFAULT 0,
    daemon_token_hash VARCHAR(255) NOT NULL,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allocations table (port allocations on nodes)
CREATE TABLE allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    server_id UUID,  -- References servers, but created before servers table
    ip_address VARCHAR(45) NOT NULL,
    port INTEGER NOT NULL,
    notes VARCHAR(255),
    assigned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(node_id, port)
);

-- Servers table (game server instances)
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    memory_limit INTEGER NOT NULL,        -- in MB
    disk_limit INTEGER NOT NULL,          -- in MB
    cpu_limit INTEGER DEFAULT 100,        -- percentage (100 = 1 core)
    docker_image VARCHAR(255) NOT NULL DEFAULT 'itzg/minecraft-server',
    status VARCHAR(50) DEFAULT 'installing',
    primary_allocation_id UUID,
    environment JSONB DEFAULT '{}',       -- Includes TYPE for server type (e.g., TYPE=LEAF)
    container_id VARCHAR(100),            -- Docker container ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key from allocations to servers after servers table exists
ALTER TABLE allocations 
    ADD CONSTRAINT fk_allocations_server 
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL;

-- Add foreign key from servers to allocations for primary allocation
ALTER TABLE servers 
    ADD CONSTRAINT fk_servers_primary_allocation 
    FOREIGN KEY (primary_allocation_id) REFERENCES allocations(id);

-- Indexes for performance
CREATE INDEX idx_servers_user_id ON servers(user_id);
CREATE INDEX idx_servers_node_id ON servers(node_id);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_allocations_node_id ON allocations(node_id);
CREATE INDEX idx_allocations_server_id ON allocations(server_id);
CREATE INDEX idx_allocations_assigned ON allocations(assigned);

-- Billing: Plans table
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    price_cents INTEGER NOT NULL,
    servers_limit INTEGER NOT NULL,
    ram_per_server_mb INTEGER NOT NULL,
    storage_mb INTEGER NOT NULL,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing: Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(20) DEFAULT 'active',
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing: Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    amount_cents INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    invoice_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for billing
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);

-- Insert default plans
INSERT INTO plans (id, name, price_cents, servers_limit, ram_per_server_mb, storage_mb, features) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Starter', 500, 1, 2048, 10240, '["1 Server", "2 GB RAM", "10 GB Storage", "Basic Support"]'),
    ('00000000-0000-0000-0000-000000000002', 'Pro', 1500, 5, 8192, 51200, '["5 Servers", "8 GB RAM each", "50 GB Storage", "Priority Support", "Custom Domain"]'),
    ('00000000-0000-0000-0000-000000000003', 'Enterprise', 4900, 100, 32768, 512000, '["Unlimited Servers", "32 GB RAM each", "500 GB Storage", "24/7 Support", "Dedicated IP", "DDoS Protection"]');

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
