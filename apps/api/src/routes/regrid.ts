import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';

const RegridFetchSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

const RegridPointSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  radius: z.number().optional().default(250), // Default 250m radius
});

export const regridRoutes: FastifyPluginAsync = async (fastify) => {
  // Proxy and cache Regrid API requests
  fastify.post('/regrid/fetch', async (request, reply) => {
    const { bbox } = RegridFetchSchema.parse(request.body);
    const [minLng, minLat, maxLng, maxLat] = bbox;

    try {
      // Check cache first
      const cacheKey = `regrid_${bbox.join('_')}`;
      const { data: cached } = await supabase
        .from('regrid_cache')
        .select('data, created_at')
        .eq('cache_key', cacheKey)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24h TTL
        .single();

      if (cached) {
        fastify.log.info('Returning cached Regrid data');
        return cached.data;
      }

      // Fetch from Regrid API v2 area search with polygon
      const regridUrl = new URL('https://app.regrid.com/api/v2/parcels/area');
      regridUrl.searchParams.set('token', config.REGRID_API_KEY);
      regridUrl.searchParams.set('limit', '1000');
      
      // Convert bbox to GeoJSON polygon
      const polygon = {
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat], 
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]]
      };
      regridUrl.searchParams.set('geojson', JSON.stringify(polygon));

      const response = await fetch(regridUrl.toString(), {
        headers: {
          'User-Agent': 'YardQualifier/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Regrid API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the response
      await supabase
        .from('regrid_cache')
        .upsert({
          cache_key: cacheKey,
          data,
          bbox_geom: `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`,
        });

      // Transform and insert new parcels
      if (data.features && data.features.length > 0) {
        const parcels = data.features.map((feature: any) => ({
          apn: feature.properties.parcelnumb || feature.properties.ll_gissid || 'unknown',
          address: feature.properties.saddno && feature.properties.saddstr 
            ? `${feature.properties.saddno} ${feature.properties.saddstr}`.trim()
            : null,
          geometry: feature.geometry,
          lot_area: feature.properties.shape_area || 0,
          zoning_code: feature.properties.zoning || null,
          last_sale_price: null,
          last_sale_date: null,
          rear_free_sqft: null,
          has_pool: null,
          qualifies: null,
          rationale: null,
          hoa_status: 'unknown' as const,
        }));

        // Insert parcels (ignore conflicts)
        await supabase
          .from('parcels')
          .upsert(parcels, { onConflict: 'apn', ignoreDuplicates: true });

        fastify.log.info(`Inserted ${parcels.length} parcels from Regrid`);
      }

      return data;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { 
        error: 'Failed to fetch parcel data',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Fetch parcel data by coordinates (lat/lon)
  fastify.post('/regrid/parcel', async (request, reply) => {
    const { lat, lon, radius } = RegridPointSchema.parse(request.body);

    try {
      // Create a small bounding box around the point (convert meters to degrees)
      const latDegreesPerMeter = 1 / 111000; // Approximate
      const lonDegreesPerMeter = 1 / (111000 * Math.cos(lat * Math.PI / 180));
      
      const latOffset = radius * latDegreesPerMeter;
      const lonOffset = radius * lonDegreesPerMeter;
      
      const minLat = lat - latOffset;
      const maxLat = lat + latOffset;
      const minLng = lon - lonOffset;
      const maxLng = lon + lonOffset;
      const bbox = [minLng, minLat, maxLng, maxLat];

      // Check cache first - look for nearby cached data
      const { data: cached } = await supabase
        .from('regrid_cache')
        .select('data, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24h TTL
        .filter('bbox_geom', 'st_contains', `POINT(${lon} ${lat})`)
        .single();

      if (cached) {
        fastify.log.info('Found cached data containing the point');
        // Filter the cached data to find parcels near our point
        const nearbyParcels = cached.data.features?.filter((feature: any) => {
          if (!feature.geometry?.coordinates) return false;
          
          // For polygon geometries, check if point is roughly within bounds
          if (feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0];
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            
            coords.forEach(([x, y]: [number, number]) => {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            });
            
            return lon >= minX && lon <= maxX && lat >= minY && lat <= maxY;
          }
          
          return false;
        }) || [];

        if (nearbyParcels.length > 0) {
          return {
            type: 'FeatureCollection',
            features: nearbyParcels.slice(0, 1), // Return closest parcel
          };
        }
      }

      // If no cached data, fetch from Regrid API v2 point search
      const regridUrl = new URL('https://app.regrid.com/api/v2/parcels/point');
      regridUrl.searchParams.set('token', config.REGRID_API_KEY);
      regridUrl.searchParams.set('lat', lat.toString());
      regridUrl.searchParams.set('lon', lon.toString());
      regridUrl.searchParams.set('radius', radius.toString()); // Radius is already in meters

      const response = await fetch(regridUrl.toString(), {
        headers: {
          'User-Agent': 'YardQualifier/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Regrid API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the response
      const cacheKey = `regrid_point_${lat}_${lon}_${radius}`;
      await supabase
        .from('regrid_cache')
        .upsert({
          cache_key: cacheKey,
          data,
          bbox_geom: `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`,
        });

      // Find the parcel that contains or is closest to our point
      let targetParcel = null;
      let minDistance = Infinity;

      if (data.features && data.features.length > 0) {
        for (const feature of data.features) {
          if (feature.geometry?.type === 'Polygon') {
            // Calculate rough center of polygon for distance comparison
            const coords = feature.geometry.coordinates[0];
            let centerX = 0, centerY = 0;
            
            coords.forEach(([x, y]: [number, number]) => {
              centerX += x;
              centerY += y;
            });
            
            centerX /= coords.length;
            centerY /= coords.length;
            
            const distance = Math.sqrt(
              Math.pow(lon - centerX, 2) + Math.pow(lat - centerY, 2)
            );
            
            if (distance < minDistance) {
              minDistance = distance;
              targetParcel = feature;
            }
          }
        }

        // Transform and insert the closest parcel if found
        if (targetParcel) {
          const parcel = {
            apn: targetParcel.properties.parcelnumb || targetParcel.properties.ll_gissid || 'unknown',
            address: targetParcel.properties.saddno && targetParcel.properties.saddstr 
              ? `${targetParcel.properties.saddno} ${targetParcel.properties.saddstr}`.trim()
              : null,
            geometry: targetParcel.geometry,
            lot_area: targetParcel.properties.shape_area || 0,
            zoning_code: targetParcel.properties.zoning || null,
            last_sale_price: null,
            last_sale_date: null,
            rear_free_sqft: null,
            has_pool: null,
            qualifies: null,
            rationale: null,
            hoa_status: 'unknown' as const,
          };

          // Insert parcel (ignore conflicts)
          await supabase
            .from('parcels')
            .upsert([parcel], { onConflict: 'apn', ignoreDuplicates: true });

          fastify.log.info(`Found and cached parcel ${parcel.apn} for coordinates ${lat}, ${lon}`);

          return {
            type: 'FeatureCollection',
            features: [targetParcel],
          };
        }
      }

      // No parcel found
      fastify.log.info(`No parcel found for coordinates ${lat}, ${lon}`);
      return {
        type: 'FeatureCollection',
        features: [],
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { 
        error: 'Failed to fetch parcel data',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get cached regions
  fastify.get('/regrid/cache', async (request, reply) => {
    try {
      const { data: cacheEntries, error } = await supabase
        .from('regrid_cache')
        .select('cache_key, created_at, bbox_geom')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return {
        entries: cacheEntries || [],
        count: cacheEntries?.length || 0,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { error: 'Failed to fetch cache entries' };
    }
  });
};