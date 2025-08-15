import { FastifyPluginAsync } from 'fastify';
import { supabase } from '../lib/supabase.js';
import { ParcelSchema } from '@shared/types';

export const parcelRoutes: FastifyPluginAsync = async (fastify) => {
  // Get parcel details by ID
  fastify.get('/parcel/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const { data: parcel, error } = await supabase
        .from('parcels')
        .select(`
          *,
          building_footprints (
            id,
            geometry,
            is_primary
          ),
          cv_detections (
            id,
            kind,
            geometry,
            confidence
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          reply.status(404);
          return { error: 'Parcel not found' };
        }
        throw error;
      }

      // Transform to match our schema
      const transformedParcel = {
        id: parcel.id,
        apn: parcel.apn,
        address: parcel.address,
        geometry: parcel.geometry,
        lotArea: parcel.lot_area,
        zoningCode: parcel.zoning_code,
        lastSalePrice: parcel.last_sale_price,
        lastSaleDate: parcel.last_sale_date,
        rearFreeSqft: parcel.rear_free_sqft,
        hasPool: parcel.has_pool,
        qualifies: parcel.qualifies,
        rationale: parcel.rationale,
        hoaStatus: parcel.hoa_status,
      };

      return {
        ...transformedParcel,
        buildingFootprints: parcel.building_footprints,
        cvDetections: parcel.cv_detections,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { error: 'Failed to fetch parcel details' };
    }
  });

  // Search parcels by bounding box (for map tiles)
  fastify.get('/parcels/bbox', async (request, reply) => {
    const query = request.query as {
      minLng: string;
      minLat: string;
      maxLng: string;
      maxLat: string;
      limit?: string;
    };

    try {
      const bbox = [
        parseFloat(query.minLng),
        parseFloat(query.minLat),
        parseFloat(query.maxLng),
        parseFloat(query.maxLat),
      ];

      const limit = query.limit ? parseInt(query.limit) : 1000;

      const { data: parcels, error } = await supabase
        .rpc('parcels_in_bbox', {
          min_lng: bbox[0],
          min_lat: bbox[1],
          max_lng: bbox[2],
          max_lat: bbox[3],
        })
        .limit(limit);

      if (error) throw error;

      const transformedParcels = parcels?.map((parcel: any) => ({
        id: parcel.id,
        apn: parcel.apn,
        address: parcel.address,
        geometry: parcel.geometry,
        lotArea: parcel.lot_area,
        zoningCode: parcel.zoning_code,
        lastSalePrice: parcel.last_sale_price,
        lastSaleDate: parcel.last_sale_date,
        rearFreeSqft: parcel.rear_free_sqft,
        hasPool: parcel.has_pool,
        qualifies: parcel.qualifies,
        rationale: parcel.rationale,
        hoaStatus: parcel.hoa_status,
      })) || [];

      return {
        type: 'FeatureCollection',
        features: transformedParcels.map((parcel: any) => ({
          type: 'Feature',
          id: parcel.id,
          geometry: parcel.geometry,
          properties: {
            apn: parcel.apn,
            address: parcel.address,
            lotArea: parcel.lotArea,
            zoningCode: parcel.zoningCode,
            hasPool: parcel.hasPool,
            qualifies: parcel.qualifies,
          },
        })),
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500);
      return { error: 'Failed to fetch parcels' };
    }
  });
};