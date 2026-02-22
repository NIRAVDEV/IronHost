-- 006_user_resources.sql
-- Add resource inventory fields to users table
-- These track the user's total purchased resource pool

ALTER TABLE users ADD COLUMN IF NOT EXISTS resource_ram_mb INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS resource_cpu_cores INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS resource_storage_mb INT DEFAULT 0;
