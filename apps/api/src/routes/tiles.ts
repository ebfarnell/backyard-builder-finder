import { FastifyPluginAsync } from 'fastify';
import { supabase } from '../lib/supabase.js';

export const tilesRoutes: FastifyPluginAsync = async (fastify) => {
  // MVT vector tiles for parcels
  fastify.get('/tiles/parcels/:z/:x/:y.mvt', async (request, reply) => {
    const { z, x, y } = request.params as { z: string; x: string; y: string };

    try {
      const zoom = parseInt(z);
      const tileX = parseInt(x);
      const tileY = parseInt(y);

      // Calculate tile bounds
      const bounds = tileToBounds(tileX, tileY, zoom);

      // Query parcels within tile bounds and generate MVT
      const { data: mvtData, error } = await supabase
        .rpc('parcels_mvt_tile', {
          z: zoom,
          x: tileX,
          y: tileY,
          min_lng: bounds.minLng,
          min_lat: bounds.minLat,
          max_lng: bounds.maxLng,
          max_lat: bounds.maxLat,
        });

      if (error) throw error;

      if (!mvtData) {
        reply.status(204);
        return;
      }

      reply.type('application/x-protobuf');
      reply.header('Content-Encoding', 'gzip');
      reply.header('Cache-Control', 'public, max-age=3600');
      
      return Buffer.from(mvtData, 'base64');
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { error: 'Failed to generate tile' };
    }
  });
};

function tileToBounds(x: number, y: number, z: number) {
  const n = Math.pow(2, z);
  const minLng = (x / n) * 360 - 180;
  const maxLng = ((x + 1) / n) * 360 - 180;
  const minLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
  const maxLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;

  return { minLng, minLat, maxLng, maxLat };
}