-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create parcels table
CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apn TEXT NOT NULL UNIQUE,
    address TEXT,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    lot_area NUMERIC NOT NULL,
    zoning_code TEXT,
    last_sale_price NUMERIC,
    last_sale_date DATE,
    rear_free_sqft NUMERIC,
    has_pool BOOLEAN,
    qualifies BOOLEAN,
    rationale TEXT,
    hoa_status TEXT DEFAULT 'unknown' CHECK (hoa_status IN ('unknown', 'yes', 'no')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create building footprints table
CREATE TABLE building_footprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create CV detections table
CREATE TABLE cv_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('pool', 'building')),
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create API usage tracking table
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    search_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user API keys table
CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
    key_hash TEXT NOT NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, provider)
);

-- Create Regrid cache table
CREATE TABLE regrid_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    bbox_geom GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spatial indexes
CREATE INDEX idx_parcels_geometry ON parcels USING GIST (geometry);
CREATE INDEX idx_parcels_apn ON parcels (apn);
CREATE INDEX idx_parcels_zoning ON parcels (zoning_code);
CREATE INDEX idx_parcels_has_pool ON parcels (has_pool);
CREATE INDEX idx_parcels_qualifies ON parcels (qualifies);

CREATE INDEX idx_building_footprints_geometry ON building_footprints USING GIST (geometry);
CREATE INDEX idx_building_footprints_parcel_id ON building_footprints (parcel_id);
CREATE INDEX idx_building_footprints_is_primary ON building_footprints (is_primary);

CREATE INDEX idx_cv_detections_geometry ON cv_detections USING GIST (geometry);
CREATE INDEX idx_cv_detections_parcel_id ON cv_detections (parcel_id);
CREATE INDEX idx_cv_detections_kind ON cv_detections (kind);
CREATE INDEX idx_cv_detections_created_at ON cv_detections (created_at);

CREATE INDEX idx_api_usage_user_id ON api_usage (user_id);
CREATE INDEX idx_api_usage_created_at ON api_usage (created_at);

CREATE INDEX idx_user_api_keys_user_id ON user_api_keys (user_id);
CREATE INDEX idx_user_api_keys_provider ON user_api_keys (provider);

CREATE INDEX idx_regrid_cache_bbox ON regrid_cache USING GIST (bbox_geom);
CREATE INDEX idx_regrid_cache_created_at ON regrid_cache (created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to parcels
CREATE TRIGGER update_parcels_updated_at 
    BEFORE UPDATE ON parcels 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies

-- Parcels and building footprints are world-readable
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parcels are viewable by everyone" ON parcels FOR SELECT USING (true);
CREATE POLICY "Parcels are insertable by service role" ON parcels FOR INSERT WITH CHECK (true);
CREATE POLICY "Parcels are updatable by service role" ON parcels FOR UPDATE USING (true);

ALTER TABLE building_footprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Building footprints are viewable by everyone" ON building_footprints FOR SELECT USING (true);
CREATE POLICY "Building footprints are insertable by service role" ON building_footprints FOR INSERT WITH CHECK (true);

-- CV detections are world-readable but only insertable by service
ALTER TABLE cv_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CV detections are viewable by everyone" ON cv_detections FOR SELECT USING (true);
CREATE POLICY "CV detections are insertable by service role" ON cv_detections FOR INSERT WITH CHECK (true);

-- API usage is only accessible by the user who created it
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own API usage" ON api_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "API usage is insertable by service role" ON api_usage FOR INSERT WITH CHECK (true);

-- User API keys are only accessible by the user who owns them
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own API keys" ON user_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own API keys" ON user_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own API keys" ON user_api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own API keys" ON user_api_keys FOR DELETE USING (auth.uid() = user_id);

-- Regrid cache is world-readable but only insertable by service
ALTER TABLE regrid_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regrid cache is viewable by everyone" ON regrid_cache FOR SELECT USING (true);
CREATE POLICY "Regrid cache is insertable by service role" ON regrid_cache FOR INSERT WITH CHECK (true);