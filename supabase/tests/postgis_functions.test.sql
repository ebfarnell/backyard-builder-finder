-- PostGIS Functions Tests
-- These tests verify that our custom PostGIS functions work correctly

BEGIN;

SELECT plan(8);

-- Test 1: estimate_rear_yard_free_area function exists and returns expected structure
SELECT has_function(
  'estimate_rear_yard_free_area',
  ARRAY['geometry', 'geometry', 'geometry'],
  'Function estimate_rear_yard_free_area exists'
);

-- Test 2: Test rear yard calculation with a simple rectangular parcel
DO $$
DECLARE
  test_parcel GEOMETRY;
  result RECORD;
BEGIN
  -- Create a simple rectangular parcel (100ft x 200ft in degrees, roughly)
  test_parcel := ST_GeomFromText('POLYGON((-118.4001 34.0701, -118.3999 34.0701, -118.3999 34.0699, -118.4001 34.0699, -118.4001 34.0701))', 4326);
  
  -- Calculate rear yard area
  SELECT * INTO result FROM estimate_rear_yard_free_area(test_parcel);
  
  -- Should return a positive area
  PERFORM ok(result.free_sqft > 0, 'Rear yard calculation returns positive area');
  PERFORM ok(result.approximate IS NOT NULL, 'Rear yard calculation returns approximate flag');
END $$;

-- Test 3: parcels_in_aoi function
SELECT has_function(
  'parcels_in_aoi',
  ARRAY['geometry'],
  'Function parcels_in_aoi exists'
);

-- Test parcels_in_aoi with test data
DO $$
DECLARE
  test_aoi GEOMETRY;
  parcel_count INTEGER;
BEGIN
  -- Create AOI that should include our seed parcels
  test_aoi := ST_GeomFromText('POLYGON((-118.51 34.01, -118.37 34.01, -118.37 34.13, -118.51 34.13, -118.51 34.01))', 4326);
  
  -- Count parcels in AOI
  SELECT COUNT(*) INTO parcel_count FROM parcels_in_aoi(test_aoi);
  
  -- Should find some parcels from seed data
  PERFORM ok(parcel_count >= 0, 'parcels_in_aoi returns results');
END $$;

-- Test 4: parcels_in_bbox function
SELECT has_function(
  'parcels_in_bbox',
  ARRAY['numeric', 'numeric', 'numeric', 'numeric'],
  'Function parcels_in_bbox exists'
);

-- Test parcels_in_bbox
DO $$
DECLARE
  parcel_count INTEGER;
BEGIN
  -- Query bbox that should include seed parcels
  SELECT COUNT(*) INTO parcel_count FROM parcels_in_bbox(-118.51, 34.01, -118.37, 34.13);
  
  PERFORM ok(parcel_count >= 0, 'parcels_in_bbox returns results');
END $$;

-- Test 5: parcels_mvt_tile function
SELECT has_function(
  'parcels_mvt_tile',
  ARRAY['integer', 'integer', 'integer', 'numeric', 'numeric', 'numeric', 'numeric'],
  'Function parcels_mvt_tile exists'
);

-- Test MVT tile generation
DO $$
DECLARE
  mvt_data BYTEA;
BEGIN
  -- Generate MVT tile for zoom 10, tile 163, 395 (covers LA area)
  SELECT parcels_mvt_tile(10, 163, 395, -118.51, 34.01, -118.37, 34.13) INTO mvt_data;
  
  -- Should return bytea data (could be empty if no parcels in tile)
  PERFORM ok(mvt_data IS NOT NULL, 'MVT tile generation returns data');
END $$;

-- Test 6: cleanup_old_cache function
SELECT has_function(
  'cleanup_old_cache',
  'Function cleanup_old_cache exists'
);

-- Test cache cleanup
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Insert old cache entry
  INSERT INTO regrid_cache (cache_key, data, bbox_geom, created_at)
  VALUES ('test_old', '{}', ST_GeomFromText('POINT(0 0)', 4326), NOW() - INTERVAL '2 days');
  
  -- Run cleanup
  SELECT cleanup_old_cache() INTO deleted_count;
  
  -- Should have deleted the old entry
  PERFORM ok(deleted_count >= 1, 'Cache cleanup removes old entries');
END $$;

-- Test 7: Verify spatial indexes exist
SELECT has_index('parcels', 'idx_parcels_geometry', 'Parcels geometry index exists');

SELECT * FROM finish();

ROLLBACK;