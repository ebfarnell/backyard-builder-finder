-- Seed data for Los Angeles County pilot
-- Note: Ensure spatial indexes exist on geometry columns for optimal performance
-- CREATE INDEX IF NOT EXISTS parcels_geometry_idx ON parcels USING GIST (geometry);
-- CREATE INDEX IF NOT EXISTS building_footprints_geometry_idx ON building_footprints USING GIST (geometry);
-- CREATE INDEX IF NOT EXISTS cv_detections_geometry_idx ON cv_detections USING GIST (geometry);

BEGIN;

-- Insert sample parcels in LA County
INSERT INTO parcels (apn, address, geometry, lot_area, zoning_code, last_sale_price, last_sale_date, hoa_status) VALUES
-- Beverly Hills area parcels
('4333-001-001', '123 Beverly Dr, Beverly Hills, CA 90210', 
 ST_GeomFromText('POLYGON((-118.4001 34.0701, -118.3999 34.0701, -118.3999 34.0699, -118.4001 34.0699, -118.4001 34.0701))', 4326),
 8500, 'R1', 2500000, '2023-06-15', 'yes'),

('4333-001-002', '125 Beverly Dr, Beverly Hills, CA 90210',
 ST_GeomFromText('POLYGON((-118.3999 34.0701, -118.3997 34.0701, -118.3997 34.0699, -118.3999 34.0699, -118.3999 34.0701))', 4326),
 7200, 'R1', 2200000, '2023-08-22', 'yes'),

('4333-001-003', '127 Beverly Dr, Beverly Hills, CA 90210',
 ST_GeomFromText('POLYGON((-118.3997 34.0701, -118.3995 34.0701, -118.3995 34.0699, -118.3997 34.0699, -118.3997 34.0701))', 4326),
 6800, 'R1', 1950000, '2022-12-10', 'yes'),

('4333-001-004', '129 Beverly Dr, Beverly Hills, CA 90210',
 ST_GeomFromText('POLYGON((-118.3995 34.0701, -118.3993 34.0701, -118.3993 34.0699, -118.3995 34.0699, -118.3995 34.0701))', 4326),
 9200, 'R1', 2800000, '2023-03-18', 'yes'),

-- Santa Monica area parcels
('4293-001-001', '456 Ocean Ave, Santa Monica, CA 90401',
 ST_GeomFromText('POLYGON((-118.4951 34.0195, -118.4949 34.0195, -118.4949 34.0193, -118.4951 34.0193, -118.4951 34.0195))', 4326),
 5500, 'R2', 1800000, '2023-09-05', 'no'),

('4293-001-002', '458 Ocean Ave, Santa Monica, CA 90401',
 ST_GeomFromText('POLYGON((-118.4949 34.0195, -118.4947 34.0195, -118.4947 34.0193, -118.4949 34.0193, -118.4949 34.0195))', 4326),
 4800, 'R2', 1650000, '2023-07-12', 'no'),

-- Hollywood Hills parcels
('5554-001-001', '789 Mulholland Dr, Los Angeles, CA 90046',
 ST_GeomFromText('POLYGON((-118.3751 34.1201, -118.3749 34.1201, -118.3749 34.1199, -118.3751 34.1199, -118.3751 34.1201))', 4326),
 12000, 'R1', 3200000, '2023-04-28', 'unknown'),

('5554-001-002', '791 Mulholland Dr, Los Angeles, CA 90046',
 ST_GeomFromText('POLYGON((-118.3749 34.1201, -118.3747 34.1201, -118.3747 34.1199, -118.3749 34.1199, -118.3749 34.1201))', 4326),
 10500, 'R1', 2900000, '2022-11-15', 'unknown');

-- Insert building footprints for the parcels (approximate 2000 sq ft buildings in center)
INSERT INTO building_footprints (parcel_id, geometry, is_primary) 
SELECT 
    p.id,
    ST_Buffer(ST_Centroid(p.geometry), 0.0001),  -- ~2000 sq ft building approximation
    true
FROM parcels p
WHERE p.geometry IS NOT NULL;

-- Insert some sample CV detections (pools for high-value properties)
INSERT INTO cv_detections (parcel_id, kind, geometry, confidence)
SELECT 
    p.id,
    'pool',
    ST_Buffer(ST_Translate(ST_Centroid(p.geometry), 0.0002, -0.0002), 0.00005),  -- Pool in backyard area
    0.85
FROM parcels p 
WHERE p.apn IN ('4333-001-001', '4333-001-004', '5554-001-001', '5554-001-002')
  AND p.geometry IS NOT NULL;

-- Update parcels with pool information (batch update for better performance)
UPDATE parcels 
SET has_pool = CASE 
    WHEN apn IN ('4333-001-001', '4333-001-004', '5554-001-001', '5554-001-002') THEN true
    ELSE false
END;

-- Calculate rear yard areas for all parcels (if function exists)
-- Check if the function exists before using it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'estimate_rear_yard_free_area') THEN
        UPDATE parcels 
        SET rear_free_sqft = (
            SELECT free_sqft 
            FROM estimate_rear_yard_free_area(parcels.geometry) 
            LIMIT 1
        );
    ELSE
        -- Use a simple approximation based on lot area if function doesn't exist
        UPDATE parcels 
        SET rear_free_sqft = GREATEST(0, lot_area * 0.4 - 800);  -- Estimate 40% rear, minus building footprint
        
        RAISE NOTICE 'estimate_rear_yard_free_area function not found. Using approximation based on lot_area.';
    END IF;
END
$$;

-- Set qualification status and rationale in a single update for better performance
UPDATE parcels 
SET 
    qualifies = CASE 
        WHEN rear_free_sqft >= 1000 THEN true
        WHEN rear_free_sqft >= 500 AND rear_free_sqft < 1000 THEN null  -- Edge cases for LLM
        ELSE false
    END,
    rationale = CASE 
        WHEN rear_free_sqft >= 1000 THEN 'Meets minimum rear yard requirement with adequate space'
        WHEN rear_free_sqft < 500 THEN 'Insufficient rear yard space for requirements'
        ELSE null  -- Will be filled by LLM analysis for edge cases
    END;

-- Create a sample AOI polygon that includes all test parcels
-- This can be used for testing the search functionality
INSERT INTO regrid_cache (cache_key, data, bbox_geom) VALUES (
    'test_aoi_la_county',
    '{
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-118.51, 34.01],
                        [-118.37, 34.01],
                        [-118.37, 34.13],
                        [-118.51, 34.13],
                        [-118.51, 34.01]
                    ]]
                },
                "properties": {
                    "name": "LA County Test Area"
                }
            }
        ]
    }',
    ST_GeomFromText('POLYGON((-118.51 34.01, -118.37 34.01, -118.37 34.13, -118.51 34.13, -118.51 34.01))', 4326)
);

-- Insert some sample API usage data
INSERT INTO api_usage (user_id, search_id, provider, model, tokens_used, cost) VALUES
(gen_random_uuid(), 'search_001', 'openai', 'gpt-4o-mini', 150, 0.02),
(gen_random_uuid(), 'search_002', 'openai', 'gpt-4o-mini', 200, 0.03),
(gen_random_uuid(), 'search_003', 'openai', 'gpt-4o-mini', 180, 0.025);

COMMIT;