import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';

const RegridFetchSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
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

      // Fetch from Regrid API
      const regridUrl = new URL('https://app.regrid.com/api/v1/search.geojson');
      regridUrl.searchParams.set('token', config.REGRID_API_KEY);
      regridUrl.searchParams.set('limit', '1000');
      regridUrl.searchParams.set('bbox', bbox.join(','));

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