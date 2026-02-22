-- Add location field to nodes for region-based server creation
ALTER TABLE nodes ADD COLUMN location VARCHAR(100) DEFAULT '';
