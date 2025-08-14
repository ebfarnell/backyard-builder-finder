-- ================================================
-- Backyard Builder Finder - Development Seed Data
-- ================================================

-- Insert default development organization
INSERT INTO organizations (id, name, plan_tier, limits_jsonb, created_at)
VALUES (
    'a0000000-0000-4000-8000-000000000001'::UUID,
    'Development Organization',
    'pro',
    '{
        "monthly_searches": 100,
        "concurrent_searches": 5,
        "max_parcels_per_search": 1000,
        "cv_operations_per_month": 500,
        "llm_tokens_per_month": 100000
    }'::jsonb,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert demo LA search area for development
INSERT INTO searches (
    id, org_id, user_id, name, area_geom, area_name,
    filters_jsonb, options_jsonb, status, created_at
)
SELECT 
    'c0000000-0000-4000-8000-000000000001'::UUID,
    'a0000000-0000-4000-8000-000000000001'::UUID,
    u.id,
    'LA Demo - 1200 sqft, no pool',
    ST_GeogFromText('POLYGON((-118.5 33.9, -118.1 33.9, -118.1 34.3, -118.5 34.3, -118.5 33.9))'),
    'Los Angeles, CA',
    '{
        "unit": {
            "area_sqft": 1200,
            "rotation_allowed": true
        },
        "setbacks": {
            "front": 25,
            "rear": 15,
            "side": 10
        },
        "hoa_preference": "exclude",
        "pool_preference": "exclude",
        "trees_block_building": true,
        "exclude_flood_zones": true,
        "listing_status": "for_sale_only",
        "min_lot_sqft": 5000
    }'::jsonb,
    '{
        "preview_only": false,
        "max_parcels": 1000,
        "enable_cv": false,
        "enable_llm": true
    }'::jsonb,
    'draft',
    NOW()
FROM users u 
WHERE u.email = 'dev@backyard-builder-finder.com'
ON CONFLICT (id) DO NOTHING;

-- Create development view for easy access
CREATE OR REPLACE VIEW dev_summary AS
SELECT 
    'Organizations' AS table_name,
    COUNT(*) AS row_count
FROM organizations
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Searches', COUNT(*) FROM searches
UNION ALL
SELECT 'Parcels', COUNT(*) FROM parcels
UNION ALL
SELECT 'Footprints', COUNT(*) FROM footprints
UNION ALL
SELECT 'Listings', COUNT(*) FROM listings
ORDER BY table_name;