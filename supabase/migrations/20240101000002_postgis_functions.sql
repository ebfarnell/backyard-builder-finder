-- PostGIS functions for rear yard estimation and MVT tiles

-- Function to estimate rear yard free area
CREATE OR REPLACE FUNCTION estimate_rear_yard_free_area(
    parcel_geom GEOMETRY,
    primary_building_geom GEOMETRY DEFAULT NULL,
    road_geom GEOMETRY DEFAULT NULL
)
RETURNS TABLE(free_sqft NUMERIC, approximate BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
    parcel_centroid GEOMETRY;
    nearest_road GEOMETRY;
    road_bearing NUMERIC;
    split_line GEOMETRY;
    rear_half GEOMETRY;
    building_footprint GEOMETRY;
    rear_area_with_setbacks GEOMETRY;
    final_area NUMERIC;
    is_approximate BOOLEAN := FALSE;
BEGIN
    -- Get parcel centroid
    parcel_centroid := ST_Centroid(parcel_geom);
    
    -- Find primary building footprint if not provided
    IF primary_building_geom IS NULL THEN
        SELECT geometry INTO primary_building_geom
        FROM building_footprints bf
        JOIN parcels p ON bf.parcel_id = p.id
        WHERE ST_Within(bf.geometry, parcel_geom)
        AND bf.is_primary = TRUE
        LIMIT 1;
        
        -- If no primary building found, use the largest one
        IF primary_building_geom IS NULL THEN
            SELECT geometry INTO primary_building_geom
            FROM building_footprints bf
            JOIN parcels p ON bf.parcel_id = p.id
            WHERE ST_Within(bf.geometry, parcel_geom)
            ORDER BY ST_Area(bf.geometry) DESC
            LIMIT 1;
            
            is_approximate := TRUE;
        END IF;
    END IF;
    
    -- Find nearest road if not provided
    IF road_geom IS NULL THEN
        -- This would typically query a roads table
        -- For now, we'll use a simplified approach
        is_approximate := TRUE;
        
        -- Create a simplified "front" direction based on parcel orientation
        -- In a real implementation, you'd have road centerline data
        road_bearing := 0; -- Default to north-south orientation
    ELSE
        -- Calculate bearing from road geometry
        road_bearing := degrees(ST_Azimuth(
            ST_StartPoint(ST_ExteriorRing(road_geom)),
            ST_EndPoint(ST_ExteriorRing(road_geom))
        ));
    END IF;
    
    -- If we have a building, use it to determine front/rear split
    IF primary_building_geom IS NOT NULL THEN
        -- Create a line perpendicular to road bearing through building centroid
        split_line := ST_MakeLine(
            ST_Project(ST_Centroid(primary_building_geom), 1000, radians(road_bearing + 90)),
            ST_Project(ST_Centroid(primary_building_geom), 1000, radians(road_bearing - 90))
        );
        
        -- Split parcel and take the half opposite to the road
        -- This is a simplified approach - in reality you'd need more sophisticated logic
        rear_half := ST_Difference(parcel_geom, ST_Buffer(split_line, 0.00001));
        
        -- If split didn't work well, use the back 60% of the parcel
        IF ST_Area(rear_half) < ST_Area(parcel_geom) * 0.3 THEN
            -- Fallback: use back portion based on parcel bounds
            DECLARE
                parcel_bounds GEOMETRY;
                back_line GEOMETRY;
            BEGIN
                parcel_bounds := ST_Envelope(parcel_geom);
                -- Create a line 40% from the front
                back_line := ST_MakeLine(
                    ST_PointN(ST_ExteriorRing(parcel_bounds), 1),
                    ST_PointN(ST_ExteriorRing(parcel_bounds), 3)
                );
                rear_half := ST_Difference(parcel_geom, ST_Buffer(back_line, 0.00001));
                is_approximate := TRUE;
            END;
        END IF;
    ELSE
        -- No building found, use back 60% of parcel
        DECLARE
            parcel_bounds GEOMETRY;
            back_line GEOMETRY;
        BEGIN
            parcel_bounds := ST_Envelope(parcel_geom);
            back_line := ST_MakeLine(
                ST_PointN(ST_ExteriorRing(parcel_bounds), 1),
                ST_PointN(ST_ExteriorRing(parcel_bounds), 3)
            );
            rear_half := ST_Difference(parcel_geom, ST_Buffer(back_line, 0.00001));
            is_approximate := TRUE;
        END;
    END IF;
    
    -- Apply setbacks (simplified)
    -- Front: 25ft, Sides: 10ft, Rear: 15ft
    rear_area_with_setbacks := ST_Buffer(rear_half, -0.0001); -- Rough setback in degrees
    
    -- Subtract building footprints
    IF primary_building_geom IS NOT NULL THEN
        -- Buffer building slightly for clearance
        building_footprint := ST_Buffer(primary_building_geom, 0.00002);
        rear_area_with_setbacks := ST_Difference(rear_area_with_setbacks, building_footprint);
    END IF;
    
    -- Calculate final area in square feet
    -- Convert from square degrees to square feet (approximate for LA area)
    final_area := ST_Area(rear_area_with_setbacks) * 364000 * 364000;
    
    -- Ensure we have a valid result
    IF final_area IS NULL OR final_area < 0 THEN
        final_area := 0;
        is_approximate := TRUE;
    END IF;
    
    RETURN QUERY SELECT final_area, is_approximate;
END;
$$;

-- Function to get parcels within AOI
CREATE OR REPLACE FUNCTION parcels_in_aoi(aoi_geom GEOMETRY)
RETURNS SETOF parcels
LANGUAGE sql
STABLE
AS $$
    SELECT * FROM parcels 
    WHERE ST_Intersects(geometry, aoi_geom)
    ORDER BY ST_Area(ST_Intersection(geometry, aoi_geom)) DESC;
$$;

-- Function to get parcels within bounding box
CREATE OR REPLACE FUNCTION parcels_in_bbox(
    min_lng NUMERIC,
    min_lat NUMERIC,
    max_lng NUMERIC,
    max_lat NUMERIC
)
RETURNS SETOF parcels
LANGUAGE sql
STABLE
AS $$
    SELECT * FROM parcels 
    WHERE ST_Intersects(
        geometry, 
        ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    );
$$;

-- Function to generate MVT tiles for parcels
CREATE OR REPLACE FUNCTION parcels_mvt_tile(
    z INTEGER,
    x INTEGER,
    y INTEGER,
    min_lng NUMERIC,
    min_lat NUMERIC,
    max_lng NUMERIC,
    max_lat NUMERIC
)
RETURNS BYTEA
LANGUAGE sql
STABLE
AS $$
    WITH tile_bounds AS (
        SELECT ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326) AS geom
    ),
    parcels_in_tile AS (
        SELECT 
            p.id,
            p.apn,
            p.address,
            p.zoning_code,
            p.has_pool,
            p.qualifies,
            ST_AsMVTGeom(
                p.geometry,
                (SELECT geom FROM tile_bounds),
                4096,
                256,
                true
            ) AS geom
        FROM parcels p, tile_bounds tb
        WHERE ST_Intersects(p.geometry, tb.geom)
        AND ST_AsMVTGeom(
            p.geometry,
            tb.geom,
            4096,
            256,
            true
        ) IS NOT NULL
    )
    SELECT ST_AsMVT(parcels_in_tile.*, 'parcels', 4096, 'geom')
    FROM parcels_in_tile;
$$;

-- Function to clean up old cache entries
CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete cache entries older than 24 hours
    DELETE FROM regrid_cache 
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old CV detections (older than 7 days)
    DELETE FROM cv_detections 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete expired API keys
    DELETE FROM user_api_keys 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    RETURN deleted_count;
END;
$$;

-- Create a scheduled job to clean up cache (if pg_cron is available)
-- SELECT cron.schedule('cleanup-cache', '0 2 * * *', 'SELECT cleanup_old_cache();');