-- Debug script to investigate search results issue
-- Run this against your Supabase database to check actual data

-- 1. Check if parcels exist and their basic info
SELECT 
    apn,
    address,
    lot_area,
    rear_free_sqft,
    has_pool,
    qualifies,
    ST_AsText(geometry) as geometry_wkt
FROM parcels 
ORDER BY apn;

-- 2. Check if the estimate_rear_yard_free_area function works
SELECT 
    apn,
    lot_area,
    (SELECT free_sqft FROM estimate_rear_yard_free_area(geometry)) as calculated_rear_sqft,
    rear_free_sqft as stored_rear_sqft
FROM parcels
ORDER BY apn;

-- 3. Test the AOI intersection (same as used in search)
-- This is the test AOI from seed.sql that should include all parcels
WITH test_aoi AS (
    SELECT ST_GeomFromText('POLYGON((-118.51 34.01, -118.37 34.01, -118.37 34.13, -118.51 34.13, -118.51 34.01))', 4326) as geom
)
SELECT 
    p.apn,
    p.address,
    p.lot_area,
    p.rear_free_sqft,
    ST_Intersects(p.geometry, ta.geom) as intersects_aoi,
    ST_Within(p.geometry, ta.geom) as within_aoi
FROM parcels p, test_aoi ta
ORDER BY p.apn;

-- 4. Simulate the search query from searchService.ts
-- This replicates the .overlaps() query used in Supabase
WITH test_aoi AS (
    SELECT '{
        "type": "Polygon",
        "coordinates": [[
            [-118.51, 34.01],
            [-118.37, 34.01],
            [-118.37, 34.13],
            [-118.51, 34.13],
            [-118.51, 34.01]
        ]]
    }'::jsonb as aoi_json
)
SELECT 
    p.apn,
    p.address,
    p.lot_area,
    p.rear_free_sqft,
    p.has_pool,
    p.qualifies
FROM parcels p, test_aoi ta
WHERE ST_Intersects(p.geometry, ST_GeomFromGeoJSON(ta.aoi_json))
  AND p.rear_free_sqft >= 500  -- Default minRearSqft filter
ORDER BY p.apn;

-- 5. Check what happens with different minRearSqft values
SELECT 
    'minRearSqft=500' as filter_type,
    COUNT(*) as parcel_count
FROM parcels 
WHERE rear_free_sqft >= 500

UNION ALL

SELECT 
    'minRearSqft=1000' as filter_type,
    COUNT(*) as parcel_count
FROM parcels 
WHERE rear_free_sqft >= 1000

UNION ALL

SELECT 
    'minRearSqft=100' as filter_type,
    COUNT(*) as parcel_count
FROM parcels 
WHERE rear_free_sqft >= 100;

-- 6. Check if building footprints were created correctly
SELECT 
    p.apn,
    COUNT(bf.id) as building_count,
    MAX(ST_Area(bf.geometry)) as largest_building_area
FROM parcels p
LEFT JOIN building_footprints bf ON bf.parcel_id = p.id
GROUP BY p.apn, p.address
ORDER BY p.apn;

-- 7. Check CV detections (pools)
SELECT 
    p.apn,
    p.has_pool as parcel_has_pool,
    COUNT(cv.id) as cv_detection_count,
    MAX(cv.confidence) as max_confidence
FROM parcels p
LEFT JOIN cv_detections cv ON cv.parcel_id = p.id AND cv.kind = 'pool'
GROUP BY p.apn, p.has_pool
ORDER BY p.apn;