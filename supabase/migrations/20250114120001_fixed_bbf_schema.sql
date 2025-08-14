-- ================================================
-- Backyard Builder Finder - Fixed Database Schema
-- Supabase Migration (RLS policies moved to end)
-- ================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Set timezone
SET timezone = 'UTC';

-- Create custom types
CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
CREATE TYPE sso_provider AS ENUM ('google', 'microsoft', 'email');
CREATE TYPE api_provider AS ENUM ('openai', 'anthropic', 'mapbox', 'google_maps', 'esri');
CREATE TYPE footprint_type AS ENUM ('main', 'outbuilding', 'driveway', 'pool', 'other');
CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'off_market');
CREATE TYPE export_type AS ENUM ('csv', 'geojson', 'pdf');
CREATE TYPE export_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'expired');
CREATE TYPE cv_artifact_type AS ENUM ('pool', 'tree_canopy', 'driveway', 'shed', 'other');
CREATE TYPE search_status AS ENUM ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled');

-- Create utility function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================
-- ORGANIZATIONS TABLE
-- ========================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plan_tier plan_tier NOT NULL DEFAULT 'free',
    limits_jsonb JSONB NOT NULL DEFAULT '{
        "monthly_searches": 10,
        "concurrent_searches": 1,
        "max_parcels_per_search": 100,
        "cv_operations_per_month": 50,
        "llm_tokens_per_month": 10000
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- USERS TABLE  
-- ========================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    sso_provider sso_provider NOT NULL DEFAULT 'email',
    sso_subject VARCHAR(255),
    role user_role NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_sso_subject ON users(sso_subject);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);

-- ========================
-- USER API KEYS TABLE
-- ========================

CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    provider api_provider NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used TIMESTAMPTZ,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_user_api_keys_key_hash ON user_api_keys(key_hash);

-- ========================
-- PARCELS TABLE
-- ========================

CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(100) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    region_code VARCHAR(20) NOT NULL,
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    centroid GEOGRAPHY(POINT, 4326) NOT NULL,
    assessor_id VARCHAR(50),
    address VARCHAR(500),
    lot_sqft FLOAT,
    lot_acres FLOAT,
    zoning_code VARCHAR(50),
    attrs_jsonb JSONB NOT NULL DEFAULT '{}',
    data_confidence FLOAT,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_parcels_source ON parcels(source);
CREATE INDEX idx_parcels_external_id ON parcels(external_id);
CREATE INDEX idx_parcels_region_code ON parcels(region_code);
CREATE INDEX idx_parcels_assessor_id ON parcels(assessor_id);
CREATE INDEX idx_parcels_address ON parcels(address);
CREATE INDEX idx_parcels_lot_sqft ON parcels(lot_sqft);
CREATE INDEX idx_parcels_zoning_code ON parcels(zoning_code);
CREATE INDEX idx_parcels_geom ON parcels USING GIST(geom);
CREATE INDEX idx_parcels_centroid ON parcels USING GIST(centroid);
CREATE INDEX idx_parcels_region_source ON parcels(region_code, source);

-- ========================
-- BUILDING FOOTPRINTS TABLE
-- ========================

CREATE TABLE footprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE NOT NULL,
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    area_sqft FLOAT,
    type footprint_type NOT NULL DEFAULT 'main',
    source VARCHAR(100) NOT NULL,
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_footprints_geom ON footprints USING GIST(geom);
CREATE INDEX idx_footprints_parcel ON footprints(parcel_id);

-- ========================
-- BUILDABLE AREAS TABLE
-- ========================

CREATE TABLE derived_buildable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    settings_hash VARCHAR(64) NOT NULL,
    buildable_geom GEOMETRY(POLYGON, 4326),
    area_sqft FLOAT NOT NULL DEFAULT 0.0,
    metadata_jsonb JSONB NOT NULL DEFAULT '{}',
    computation_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_derived_buildable_settings_hash ON derived_buildable(settings_hash);
CREATE INDEX idx_buildable_geom ON derived_buildable USING GIST(buildable_geom);
CREATE INDEX idx_buildable_parcel_hash ON derived_buildable(parcel_id, settings_hash);

-- ========================
-- ZONING RULES TABLE
-- ========================

CREATE TABLE zoning_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_code VARCHAR(20) NOT NULL,
    zoning_code VARCHAR(50) NOT NULL,
    rules_jsonb JSONB NOT NULL DEFAULT '{}',
    source VARCHAR(100) NOT NULL,
    source_url TEXT,
    parsed_by VARCHAR(50),
    parsed_at TIMESTAMPTZ,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_zoning_rules_region_code ON zoning_rules(region_code);
CREATE INDEX idx_zoning_rules_zoning_code ON zoning_rules(zoning_code);
CREATE INDEX idx_zoning_rules_content_hash ON zoning_rules(content_hash);
CREATE UNIQUE INDEX idx_zoning_region_code ON zoning_rules(region_code, zoning_code);

-- ========================
-- LISTINGS TABLE
-- ========================

CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE NOT NULL,
    source VARCHAR(100) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    url TEXT,
    price INTEGER,
    status listing_status NOT NULL DEFAULT 'active',
    list_date TIMESTAMPTZ,
    sold_date TIMESTAMPTZ,
    days_on_market INTEGER,
    attrs_jsonb JSONB NOT NULL DEFAULT '{}',
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_stale BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_listings_source ON listings(source);
CREATE INDEX idx_listings_external_id ON listings(external_id);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_parcel_status ON listings(parcel_id, status);
CREATE UNIQUE INDEX idx_listings_source_external ON listings(source, external_id);

-- ========================
-- CV ARTIFACTS TABLE
-- ========================

CREATE TABLE cv_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE NOT NULL,
    type cv_artifact_type NOT NULL,
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    area_sqft FLOAT,
    source VARCHAR(100) NOT NULL,
    confidence FLOAT NOT NULL,
    model_version VARCHAR(50),
    detection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    human_verified BOOLEAN NOT NULL DEFAULT false,
    is_valid BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_cv_artifacts_type ON cv_artifacts(type);
CREATE INDEX idx_cv_artifacts_geom ON cv_artifacts USING GIST(geom);
CREATE INDEX idx_cv_artifacts_parcel_type ON cv_artifacts(parcel_id, type);

-- ========================
-- SEARCHES TABLE
-- ========================

CREATE TABLE searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    area_geom GEOGRAPHY(POLYGON, 4326) NOT NULL,
    area_name VARCHAR(255),
    filters_jsonb JSONB NOT NULL DEFAULT '{}',
    options_jsonb JSONB NOT NULL DEFAULT '{}',
    status search_status NOT NULL DEFAULT 'draft',
    total_candidates INTEGER,
    filtered_count INTEGER,
    results_count INTEGER,
    execution_time_ms INTEGER,
    stage_timings_jsonb JSONB,
    costs_jsonb JSONB,
    error_message VARCHAR(1000),
    error_details_jsonb JSONB,
    cache_key VARCHAR(64),
    results_cached_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_searches_status ON searches(status);
CREATE INDEX idx_searches_cache_key ON searches(cache_key);

-- ========================
-- EXPORTS TABLE
-- ========================

CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    search_id UUID REFERENCES searches(id) ON DELETE CASCADE NOT NULL,
    type export_type NOT NULL,
    options_jsonb JSONB NOT NULL DEFAULT '{}',
    status export_status NOT NULL DEFAULT 'queued',
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(500),
    file_size_bytes INTEGER,
    download_url VARCHAR(1000),
    url_expires_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    records_exported INTEGER,
    error_message VARCHAR(1000),
    error_details_jsonb JSONB,
    download_count INTEGER NOT NULL DEFAULT 0,
    max_downloads INTEGER NOT NULL DEFAULT 10,
    auto_delete_after_days INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_exports_type ON exports(type);
CREATE INDEX idx_exports_status ON exports(status);

-- ========================
-- AUDIT LOGS TABLE
-- ========================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    metadata_jsonb JSONB NOT NULL DEFAULT '{}',
    success VARCHAR(10) NOT NULL DEFAULT 'unknown',
    error_message TEXT,
    duration_ms INTEGER,
    cv_operations INTEGER NOT NULL DEFAULT 0,
    llm_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ========================
-- UPDATE TRIGGERS
-- ========================

-- Create update triggers for updated_at columns
CREATE TRIGGER trigger_update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_user_api_keys_updated_at
    BEFORE UPDATE ON user_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_parcels_updated_at
    BEFORE UPDATE ON parcels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_footprints_updated_at
    BEFORE UPDATE ON footprints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_zoning_rules_updated_at
    BEFORE UPDATE ON zoning_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_searches_updated_at
    BEFORE UPDATE ON searches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_exports_updated_at
    BEFORE UPDATE ON exports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- ENABLE ROW LEVEL SECURITY
-- ========================

-- Enable RLS on all user-specific tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ========================
-- ROW LEVEL SECURITY POLICIES
-- ========================

-- Organizations policy: users can only see their own org
CREATE POLICY "Users can view their own organization" ON organizations
    FOR ALL USING (auth.uid()::text IN (
        SELECT users.auth_user_id::text FROM users WHERE users.org_id = organizations.id
    ));

-- Users policy: users can only see users in their org
CREATE POLICY "Users can view users in their organization" ON users
    FOR ALL USING (auth.uid() = auth_user_id OR org_id IN (
        SELECT org_id FROM users WHERE auth_user_id = auth.uid()
    ));

-- API keys policy: users can only access their own API keys
CREATE POLICY "Users can manage their own API keys" ON user_api_keys
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE auth_user_id = auth.uid()
    ));

-- Searches policy: users can only access searches from their org
CREATE POLICY "Users can manage searches in their organization" ON searches
    FOR ALL USING (org_id IN (
        SELECT org_id FROM users WHERE auth_user_id = auth.uid()
    ));

-- Exports policy: users can only access exports from their org
CREATE POLICY "Users can manage exports in their organization" ON exports
    FOR ALL USING (org_id IN (
        SELECT org_id FROM users WHERE auth_user_id = auth.uid()
    ));

-- Audit logs policy: users can only view logs from their org
CREATE POLICY "Users can view audit logs from their organization" ON audit_logs
    FOR SELECT USING (org_id IN (
        SELECT org_id FROM users WHERE auth_user_id = auth.uid()
    ));

-- ========================
-- FUNCTIONS FOR USER MANAGEMENT
-- ========================

-- Function to create user profile when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a default organization for new users if they don't have one
    -- This will be handled by the application logic instead
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================
-- COMMENTS FOR DOCUMENTATION
-- ========================

COMMENT ON TABLE organizations IS 'Multi-tenant organizations with usage limits';
COMMENT ON TABLE users IS 'User profiles linked to Supabase auth users';
COMMENT ON TABLE user_api_keys IS 'Encrypted user API keys for external services';
COMMENT ON TABLE parcels IS 'Property parcel data with geometry and attributes';
COMMENT ON TABLE footprints IS 'Building footprints and structures on parcels';
COMMENT ON TABLE derived_buildable IS 'Computed buildable areas after setbacks and exclusions';
COMMENT ON TABLE zoning_rules IS 'Zoning regulations and building codes by region';
COMMENT ON TABLE listings IS 'Real estate listings data';
COMMENT ON TABLE cv_artifacts IS 'Computer vision detected features (pools, trees, etc.)';
COMMENT ON TABLE searches IS 'Saved searches with filters and results';
COMMENT ON TABLE exports IS 'Export jobs for CSV, GeoJSON, and PDF generation';
COMMENT ON TABLE audit_logs IS 'Audit trail for all user actions and system events';