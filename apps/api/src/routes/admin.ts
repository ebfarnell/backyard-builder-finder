import { FastifyPluginAsync } from 'fastify';
import { realDataService } from '../services/realDataService.js';
import { supabase } from '../lib/supabase.js';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Enable real data mode
  fastify.post('/admin/enable-real-data', async (request, reply) => {
    try {
      // Validate configuration first
      const configCheck = realDataService.validateConfiguration();
      if (!configCheck.valid) {
        reply.status(400);
        return {
          error: 'Missing required configuration',
          missing: configCheck.missing,
          message: 'Please set the following environment variables: ' + configCheck.missing.join(', ')
        };
      }

      await realDataService.enableRealDataMode();
      
      return {
        success: true,
        message: 'Real data mode enabled. Seed data cleared.',
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { 
        error: 'Failed to enable real data mode',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Check data status
  fastify.get('/admin/data-status', async (request, reply) => {
    try {
      const { count: parcelCount } = await supabase
        .from('parcels')
        .select('id', { count: 'exact', head: true });

      const { data: recentParcels } = await supabase
        .from('parcels')
        .select('apn, address, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const configCheck = realDataService.validateConfiguration();

      return {
        totalParcels: parcelCount || 0,
        recentParcels: recentParcels || [],
        configuration: configCheck,
        dataSource: parcelCount && parcelCount > 8 ? 'seed_data' : 'real_data_or_empty',
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { error: 'Failed to get data status' };
    }
  });

  // Fetch real data for specific area
  fastify.post('/admin/fetch-area-data', async (request, reply) => {
    const body = request.body as { aoi: any; maxParcels?: number };
    
    if (!body.aoi) {
      reply.status(400);
      return { error: 'AOI (area of interest) is required' };
    }

    try {
      const configCheck = realDataService.validateConfiguration();
      if (!configCheck.valid) {
        reply.status(400);
        return {
          error: 'Missing required configuration',
          missing: configCheck.missing,
        };
      }

      await realDataService.fetchParcelsForArea(body.aoi, body.maxParcels || 1000);
      
      // Count parcels in the area
      const { data: parcelsInArea } = await supabase
        .from('parcels')
        .select('id', { count: 'exact', head: true })
        .overlaps('geometry', JSON.stringify(body.aoi));

      return {
        success: true,
        message: `Fetched real data for area`,
        parcelsInArea: parcelsInArea || 0,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { 
        error: 'Failed to fetch area data',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Reset to seed data
  fastify.post('/admin/reset-to-seed-data', async (request, reply) => {
    try {
      // Clear all data
      await supabase.from('parcels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('building_footprints').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('cv_detections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Re-run seed data (would need to execute seed.sql)
      // For now, just return success
      
      return {
        success: true,
        message: 'Data cleared. Please re-run database migrations and seed data.',
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { error: 'Failed to reset data' };
    }
  });
};