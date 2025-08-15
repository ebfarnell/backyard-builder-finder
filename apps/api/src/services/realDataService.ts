import type { Geometry } from '@shared/types';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';

interface RegridParcel {
  id: string;
  properties: {
    parcel_id: string;
    address: string;
    zoning: string;
    lot_size_acres: number;
    last_sale_price?: number;
    last_sale_date?: string;
  };
  geometry: Geometry;
}

export class RealDataService {
  /**
   * Fetch real parcel data for a given area of interest
   */
  async fetchParcelsForArea(aoi: Geometry, maxParcels: number = 1000): Promise<void> {
    try {
      // Calculate bounding box from AOI
      const bbox = this.calculateBoundingBox(aoi);
      
      // Check cache first
      const cacheKey = `regrid_${bbox.join('_')}`;
      const { data: cached } = await supabase
        .from('regrid_cache')
        .select('data')
        .eq('cache_key', cacheKey)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24h TTL
        .single();

      let regridData;
      if (cached) {
        regridData = cached.data;
      } else {
        // Fetch from Regrid API
        regridData = await this.fetchFromRegridAPI(bbox, maxParcels);
        
        // Cache the result
        await supabase
          .from('regrid_cache')
          .upsert({
            cache_key: cacheKey,
            data: regridData,
            bbox_geom: `POLYGON((${bbox[0]} ${bbox[1]}, ${bbox[2]} ${bbox[1]}, ${bbox[2]} ${bbox[3]}, ${bbox[0]} ${bbox[3]}, ${bbox[0]} ${bbox[1]}))`,
          });
      }

      // Process and store parcels
      await this.processParcels(regridData.features, aoi);
      
    } catch (error) {
      console.error('Failed to fetch real parcel data:', error);
      throw new Error('Real data fetch failed. Using cached data if available.');
    }
  }

  private async fetchFromRegridAPI(bbox: number[], maxParcels: number): Promise<any> {
    const regridUrl = new URL('https://app.regrid.com/api/v1/search.geojson');
    regridUrl.searchParams.set('token', config.REGRID_API_KEY);
    regridUrl.searchParams.set('limit', Math.min(maxParcels, 1000).toString()); // Regrid max is 1000
    regridUrl.searchParams.set('bbox', bbox.join(','));

    console.log(`Fetching from Regrid API: ${bbox.join(',')} (limit: ${Math.min(maxParcels, 1000)})`);

    const response = await fetch(regridUrl.toString(), {
      headers: {
        'User-Agent': 'YardQualifier/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Regrid API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Regrid API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Regrid API returned ${data.features?.length || 0} parcels`);
    
    return data;
  }

  private async processParcels(regridParcels: RegridParcel[], aoi: Geometry): Promise<void> {
    const parcelsToInsert = [];

    for (const regridParcel of regridParcels) {
      try {
        // Validate and transform parcel data
        const parcel = {
          apn: regridParcel.properties.parcel_id || `regrid_${regridParcel.id}`,
          address: regridParcel.properties.address || null,
          geometry: regridParcel.geometry,
          lot_area: Math.round((regridParcel.properties.lot_size_acres || 0) * 43560), // Convert acres to sq ft
          zoning_code: regridParcel.properties.zoning || null,
          last_sale_price: regridParcel.properties.last_sale_price || null,
          last_sale_date: regridParcel.properties.last_sale_date || null,
          has_pool: null, // Will be determined by CV analysis
          hoa_status: 'unknown',
          rear_free_sqft: null, // Will be calculated
          qualifies: null,
          rationale: null,
        };

        // Only include parcels that intersect with AOI
        if (this.intersectsAOI(parcel.geometry, aoi)) {
          parcelsToInsert.push(parcel);
        }
      } catch (error) {
        console.warn(`Failed to process parcel ${regridParcel.id}:`, error);
      }
    }

    // Batch insert parcels
    if (parcelsToInsert.length > 0) {
      const { error } = await supabase
        .from('parcels')
        .upsert(parcelsToInsert, { 
          onConflict: 'apn',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Failed to insert parcels:', error);
        throw error;
      }

      console.log(`Successfully processed ${parcelsToInsert.length} real parcels`);
    }
  }

  private calculateBoundingBox(geometry: Geometry): number[] {
    // Simple bounding box calculation for polygon
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0];
      let minLng = coords[0][0];
      let minLat = coords[0][1];
      let maxLng = coords[0][0];
      let maxLat = coords[0][1];

      for (const coord of coords) {
        minLng = Math.min(minLng, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLng = Math.max(maxLng, coord[0]);
        maxLat = Math.max(maxLat, coord[1]);
      }

      return [minLng, minLat, maxLng, maxLat];
    }

    throw new Error('Unsupported geometry type for bounding box calculation');
  }

  private intersectsAOI(parcelGeometry: Geometry, aoi: Geometry): boolean {
    // Simple intersection check - in production, use PostGIS
    // For now, assume all parcels from Regrid API intersect since we used bbox
    return true;
  }

  /**
   * Enable real data mode by clearing seed data and setting up real data pipeline
   */
  async enableRealDataMode(): Promise<void> {
    try {
      // Clear existing seed data
      await supabase.from('parcels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Clear related data
      await supabase.from('building_footprints').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('cv_detections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      console.log('Seed data cleared. Real data mode enabled.');
    } catch (error) {
      console.error('Failed to enable real data mode:', error);
      throw error;
    }
  }

  /**
   * Validate that required API keys are configured
   */
  validateConfiguration(): { valid: boolean; missing: string[]; details?: any } {
    const missing = [];
    const details: any = {};
    
    if (!config.REGRID_API_KEY) {
      missing.push('REGRID_API_KEY');
    } else {
      // Check if it's a JWT token (starts with eyJ)
      details.regridKeyType = config.REGRID_API_KEY.startsWith('eyJ') ? 'JWT' : 'API_KEY';
      details.regridKeyLength = config.REGRID_API_KEY.length;
    }
    
    if (!config.NAIP_TEMPLATE_URL) {
      missing.push('NAIP_TEMPLATE_URL');
    } else {
      details.naipConfigured = true;
    }

    return {
      valid: missing.length === 0,
      missing,
      details,
    };
  }
}

export const realDataService = new RealDataService();