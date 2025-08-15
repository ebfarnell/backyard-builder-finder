import { FastifyPluginAsync } from 'fastify';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (request, reply) => {
    const timestamp = new Date().toISOString();
    
    try {
      // Check database connection
      const { error: dbError } = await supabase
        .from('parcels')
        .select('id')
        .limit(1);

      if (dbError) {
        throw new Error(`Database check failed: ${dbError.message}`);
      }

      // Check CV service
      let cvServiceStatus = 'unknown';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const cvResponse = await fetch(`${config.CV_SERVICE_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        cvServiceStatus = cvResponse.ok ? 'healthy' : 'unhealthy';
      } catch {
        cvServiceStatus = 'unhealthy';
      }

      return {
        status: 'healthy',
        timestamp,
        services: {
          database: 'healthy',
          cvService: cvServiceStatus,
        },
        version: '1.0.0',
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'unhealthy',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
};