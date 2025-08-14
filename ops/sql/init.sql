-- ================================================
-- Backyard Builder Finder Database Initialization
-- ================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create additional extensions we'll need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- For text similarity searches
CREATE EXTENSION IF NOT EXISTS btree_gin;  -- For GIN indexes on multiple columns

-- Set timezone
SET timezone = 'UTC';

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE sso_provider AS ENUM ('google', 'microsoft', 'email');
CREATE TYPE footprint_type AS ENUM ('main', 'outbuilding', 'driveway');
CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'off_market');
CREATE TYPE export_type AS ENUM ('csv', 'geojson', 'pdf');
CREATE TYPE cv_artifact_type AS ENUM ('pool', 'tree_canopy', 'driveway');
CREATE TYPE search_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Performance settings for development
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Create a function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function for generating short IDs (for public-facing IDs)
CREATE OR REPLACE FUNCTION generate_short_id(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create development user with necessary permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bbf_app') THEN
        CREATE ROLE bbf_app WITH LOGIN PASSWORD 'bbf_app_dev';
    END IF;
END $$;

GRANT CONNECT ON DATABASE bbf_dev TO bbf_app;
GRANT USAGE ON SCHEMA public TO bbf_app;
GRANT CREATE ON SCHEMA public TO bbf_app;

-- Grant permissions on PostGIS functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bbf_app;

-- Display successful initialization
SELECT 'Backyard Builder Finder database initialized successfully!' as status;