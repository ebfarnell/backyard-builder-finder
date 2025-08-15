import type { SearchRequest, SearchProgress, Parcel } from '@shared/types';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { cvService } from './cvService.js';
import { llmService } from './llmService.js';
import { realDataService } from './realDataService.js';

interface ParcelWithRearYard {
  id: string;
  apn: string;
  address: string | null;
  geometry: any;
  lot_area: number;
  zoning_code: string | null;
  last_sale_price: number | null;
  last_sale_date: string | null;
  has_pool: boolean | null;
  hoa_status: string;
  rear_free_sqft: number;
  rear_yard_approximate: boolean;
  qualifies?: boolean | null;
  rationale?: string | null;
}

export class SearchService {
  async executeSearch(
    searchId: string,
    request: SearchRequest,
    onProgress: (progress: SearchProgress) => void
  ): Promise<void> {
    try {
      // Stage A: SQL/PostGIS filtering (with potential Regrid fetch)
      onProgress({
        stage: 'sql_filter',
        processed: 0,
        total: 0,
        message: 'Checking for parcels in area and fetching from Regrid if needed...',
      });

      const sqlResults = await this.executeSQLFiltering(request);

      onProgress({
        stage: 'sql_filter',
        processed: sqlResults.length,
        total: sqlResults.length,
        message: `Found ${sqlResults.length} parcels matching basic criteria`,
      });

      if (sqlResults.length === 0) {
        onProgress({
          stage: 'complete',
          processed: 0,
          total: 0,
          message: 'No parcels found matching criteria',
          results: [],
        });
        return;
      }

      // Stage B: Computer Vision Analysis
      onProgress({
        stage: 'cv_analysis',
        processed: 0,
        total: sqlResults.length,
        message: 'Analyzing imagery for pool detection...',
      });

      const cvResults = await this.executeCVAnalysis(sqlResults, onProgress);

      // Stage C: LLM Analysis for edge cases
      const edgeCases = this.identifyEdgeCases(cvResults, request);

      if (edgeCases.length > 0) {
        onProgress({
          stage: 'llm_analysis',
          processed: 0,
          total: edgeCases.length,
          message: 'AI analysis for edge cases...',
        });

        await this.executeLLMAnalysis(searchId, edgeCases, request, onProgress);
      }

      // Final results
      const finalResults = await this.getFinalResults(sqlResults.map(p => p.id));

      onProgress({
        stage: 'complete',
        processed: finalResults.length,
        total: finalResults.length,
        message: `Analysis complete. ${finalResults.filter(p => p.qualifies).length} parcels qualify.`,
        results: finalResults,
      });

    } catch (error) {
      onProgress({
        stage: 'error',
        processed: 0,
        total: 0,
        message: 'Search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async executeSQLFiltering(request: SearchRequest): Promise<ParcelWithRearYard[]> {
    const { aoi, filters } = request;

    // First, check if we have sufficient parcels in the AOI
    const existingParcelsCount = await this.getExistingParcelsCount(aoi);
    console.log(`Found ${existingParcelsCount} existing parcels in AOI`);

    // If we have fewer than 10 parcels in the AOI, fetch from Regrid
    if (existingParcelsCount < 10) {
      console.log('Insufficient existing parcels, fetching from real data sources...');
      try {
        await realDataService.fetchParcelsForArea(aoi, config.MAX_PARCELS_PER_SEARCH);
      } catch (error) {
        console.warn('Failed to fetch real data, proceeding with existing data:', error);
      }
    }

    // Build the query with proper geometry handling
    let query = supabase
      .from('parcels')
      .select('*')
      .overlaps('geometry', JSON.stringify(aoi))
      .limit(config.MAX_PARCELS_PER_SEARCH);

    // Apply filters efficiently
    query = this.applyFilters(query, filters);

    const { data: parcels, error } = await query;
    if (error) throw error;

    if (!parcels?.length) {
      console.log('No parcels found after Regrid fetch - AOI may be in unsupported area');
      return [];
    }

    console.log(`Found ${parcels.length} parcels after filtering`);

    // Batch process rear yard calculations for better performance
    return await this.calculateRearYardsInBatches(parcels, filters.minRearSqft);
  }

  private applyFilters(query: any, filters: SearchRequest['filters']): any {
    if (filters.lotSizeMin) {
      query = query.gte('lot_area', filters.lotSizeMin);
    }
    if (filters.lotSizeMax) {
      query = query.lte('lot_area', filters.lotSizeMax);
    }
    if (filters.zoningCodes?.length) {
      query = query.in('zoning_code', filters.zoningCodes);
    }
    if (filters.hasPool !== undefined) {
      query = query.eq('has_pool', filters.hasPool);
    }
    if (filters.hoaStatus && filters.hoaStatus !== 'unknown') {
      query = query.eq('hoa_status', filters.hoaStatus);
    }
    if (filters.lastSaleDateFrom) {
      query = query.gte('last_sale_date', filters.lastSaleDateFrom);
    }
    if (filters.lastSaleDateTo) {
      query = query.lte('last_sale_date', filters.lastSaleDateTo);
    }
    return query;
  }

  private async calculateRearYardsInBatches(
    parcels: any[],
    minRearSqft: number
  ): Promise<ParcelWithRearYard[]> {
    const BATCH_SIZE = 10;
    const results: ParcelWithRearYard[] = [];

    for (let i = 0; i < parcels.length; i += BATCH_SIZE) {
      const batch = parcels.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (parcel) => {
        try {
          // First check if parcel already has rear_free_sqft calculated
          if (parcel.rear_free_sqft !== null && parcel.rear_free_sqft !== undefined) {
            return {
              ...parcel,
              rear_free_sqft: parcel.rear_free_sqft,
              rear_yard_approximate: false, // From seed data, not approximate
            } as ParcelWithRearYard;
          }

          // If not, calculate it using the PostGIS function
          const { data: rearYardResult } = await supabase
            .rpc('estimate_rear_yard_free_area', {
              parcel_geom: parcel.geometry,
              primary_building_geom: null,
              road_geom: null,
            });

          // Include ALL parcels in results, regardless of minRearSqft
          // The filtering will happen later in the pipeline
          return {
            ...parcel,
            rear_free_sqft: rearYardResult?.free_sqft || 0,
            rear_yard_approximate: rearYardResult?.approximate || true,
          } as ParcelWithRearYard;

        } catch (error) {
          console.warn(`Failed to calculate rear yard for parcel ${parcel.id}:`, error);
          // Still include the parcel, just with 0 rear yard area
          return {
            ...parcel,
            rear_free_sqft: 0,
            rear_yard_approximate: true,
          } as ParcelWithRearYard;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Now apply the minRearSqft filter to the final results
    return results.filter(parcel => parcel.rear_free_sqft >= minRearSqft);
  }

  private async executeCVAnalysis(
    parcels: ParcelWithRearYard[],
    onProgress: (progress: SearchProgress) => void
  ): Promise<ParcelWithRearYard[]> {
    const BATCH_SIZE = 5; // Smaller batches for CV processing
    const CACHE_TTL_DAYS = 7;
    const results: ParcelWithRearYard[] = [];
    let processed = 0;

    // First, check for existing detections in batch
    const parcelIds = parcels.map(p => p.id);
    const { data: existingDetections } = await supabase
      .from('cv_detections')
      .select('parcel_id, confidence')
      .in('parcel_id', parcelIds)
      .eq('kind', 'pool')
      .gte('created_at', new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString());

    const detectionMap = new Map(
      existingDetections?.map(d => [d.parcel_id, d.confidence > 0.5]) || []
    );

    // Process in batches
    for (let i = 0; i < parcels.length; i += BATCH_SIZE) {
      const batch = parcels.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (parcel) => {
        try {
          let hasPool = detectionMap.get(parcel.id);

          if (hasPool === undefined) {
            // Call CV service for new detection
            const cvResult = await cvService.detectPools(parcel);
            hasPool = cvResult.pools.length > 0 && cvResult.pools[0].confidence > 0.5;
          }

          return { ...parcel, has_pool: hasPool };
        } catch (error) {
          console.warn(`CV analysis failed for parcel ${parcel.id}:`, error);
          return parcel; // Keep parcel without pool detection
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      processed += batch.length;

      // Batch update parcels with pool detection results
      const updates = batchResults
        .filter(p => p.has_pool !== undefined && p.has_pool !== null)
        .map(p => ({ id: p.id, has_pool: p.has_pool as boolean }));

      if (updates.length > 0) {
        await this.batchUpdateParcels(updates);
      }

      onProgress({
        stage: 'cv_analysis',
        processed,
        total: parcels.length,
        message: `Analyzed ${processed}/${parcels.length} parcels for pools`,
      });
    }

    return results;
  }

  private async batchUpdateParcels(updates: Array<{ id: string; has_pool: boolean }>): Promise<void> {
    try {
      // Use upsert for better performance
      const { error } = await supabase
        .from('parcels')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.warn('Batch update failed:', error);
      }
    } catch (error) {
      console.warn('Batch update error:', error);
    }
  }

  private identifyEdgeCases(parcels: ParcelWithRearYard[], request: SearchRequest): ParcelWithRearYard[] {
    const threshold = request.filters.minRearSqft;
    const tolerance = threshold * 0.1; // 10% tolerance

    return parcels.filter(parcel => {
      // Edge case 1: Near threshold (within 10%)
      if (parcel.rear_free_sqft && Math.abs(parcel.rear_free_sqft - threshold) <= tolerance) {
        return true;
      }

      // Edge case 2: Approximate rear yard calculation
      if (parcel.rear_yard_approximate) {
        return true;
      }

      // Edge case 3: Conflicting pool detection vs filter
      if (request.filters.hasPool !== undefined && parcel.has_pool !== request.filters.hasPool) {
        return true;
      }

      return false;
    });
  }

  private async executeLLMAnalysis(
    searchId: string,
    edgeCases: ParcelWithRearYard[],
    request: SearchRequest,
    onProgress: (progress: SearchProgress) => void
  ): Promise<void> {
    let processed = 0;
    let totalCost = 0;
    const updates: Array<{ id: string; qualifies: boolean; rationale: string }> = [];
    const usageRecords: Array<{
      user_id: string;
      search_id: string;
      provider: string;
      model: string;
      tokens_used: number;
      cost: number;
    }> = [];

    // Sort edge cases by priority (near threshold first)
    const sortedEdgeCases = this.prioritizeEdgeCases(edgeCases, request.filters.minRearSqft);

    for (const parcel of sortedEdgeCases) {
      try {
        if (totalCost >= config.LLM_BUDGET_PER_SEARCH) {
          console.warn(`LLM budget exceeded (${totalCost.toFixed(2)}/${config.LLM_BUDGET_PER_SEARCH}), skipping remaining ${sortedEdgeCases.length - processed} edge cases`);
          break;
        }

        const llmResult = await llmService.analyzeParcel(parcel, request.filters);
        totalCost += llmResult.cost;

        // Collect updates for batch processing
        updates.push({
          id: parcel.id,
          qualifies: llmResult.qualifies,
          rationale: llmResult.rationale,
        });

        // Collect usage records for batch insert
        usageRecords.push({
          user_id: request.userId || 'anonymous',
          search_id: searchId,
          provider: llmResult.provider,
          model: llmResult.model,
          tokens_used: llmResult.tokensUsed,
          cost: llmResult.cost,
        });

        processed++;

        // Batch update every 5 parcels or at the end
        if (updates.length >= 5 || processed === sortedEdgeCases.length) {
          await this.batchUpdateParcelAnalysis(updates);
          await this.batchInsertUsageRecords(usageRecords);
          updates.length = 0;
          usageRecords.length = 0;
        }

        onProgress({
          stage: 'llm_analysis',
          processed,
          total: sortedEdgeCases.length,
          message: `AI analyzed ${processed}/${sortedEdgeCases.length} edge cases ($${totalCost.toFixed(2)}/$${config.LLM_BUDGET_PER_SEARCH})`,
        });

      } catch (error) {
        console.warn(`LLM analysis failed for parcel ${parcel.id}:`, error);
        processed++;
      }
    }

    // Handle any remaining updates
    if (updates.length > 0) {
      await this.batchUpdateParcelAnalysis(updates);
      await this.batchInsertUsageRecords(usageRecords);
    }
  }

  private prioritizeEdgeCases(edgeCases: ParcelWithRearYard[], threshold: number): ParcelWithRearYard[] {
    return edgeCases.sort((a, b) => {
      // Prioritize parcels closer to threshold
      const aDistance = Math.abs(a.rear_free_sqft - threshold);
      const bDistance = Math.abs(b.rear_free_sqft - threshold);
      return aDistance - bDistance;
    });
  }

  private async batchUpdateParcelAnalysis(updates: Array<{ id: string; qualifies: boolean; rationale: string }>): Promise<void> {
    try {
      const { error } = await supabase
        .from('parcels')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.warn('Batch parcel analysis update failed:', error);
      }
    } catch (error) {
      console.warn('Batch parcel analysis update error:', error);
    }
  }

  private async batchInsertUsageRecords(records: Array<{
    user_id: string;
    search_id: string;
    provider: string;
    model: string;
    tokens_used: number;
    cost: number;
  }>): Promise<void> {
    try {
      const { error } = await supabase
        .from('api_usage')
        .insert(records);

      if (error) {
        console.warn('Batch usage records insert failed:', error);
      }
    } catch (error) {
      console.warn('Batch usage records insert error:', error);
    }
  }

  private async getExistingParcelsCount(aoi: any): Promise<number> {
    const { count, error } = await supabase
      .from('parcels')
      .select('id', { count: 'exact', head: true })
      .overlaps('geometry', JSON.stringify(aoi));

    if (error) {
      console.warn('Error counting existing parcels:', error);
      return 0;
    }

    return count || 0;
  }

  private async fetchRegridDataForAOI(aoi: any): Promise<void> {
    try {
      // Convert AOI polygon to bounding box
      const bbox = this.aoiToBbox(aoi);
      console.log('Fetching Regrid data for bbox:', bbox);

      // Check if we already have cached data for this area
      const cacheKey = `regrid_${bbox.join('_')}`;
      const { data: cached } = await supabase
        .from('regrid_cache')
        .select('created_at')
        .eq('cache_key', cacheKey)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (cached) {
        console.log('Regrid data already cached for this area');
        return;
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
      console.log(`Regrid API returned ${data.features?.length || 0} parcels`);

      // Cache the response
      const [minLng, minLat, maxLng, maxLat] = bbox;
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
          apn: feature.properties.parcelnumb || feature.properties.ll_gissid || `unknown_${Date.now()}_${Math.random()}`,
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
        const { error: insertError } = await supabase
          .from('parcels')
          .upsert(parcels, { onConflict: 'apn', ignoreDuplicates: true });

        if (insertError) {
          console.warn('Error inserting Regrid parcels:', insertError);
        } else {
          console.log(`Successfully inserted ${parcels.length} parcels from Regrid`);
        }
      }

    } catch (error) {
      console.error('Failed to fetch Regrid data:', error);
      // Don't throw - continue with existing parcels
    }
  }

  private aoiToBbox(aoi: any): [number, number, number, number] {
    // Extract coordinates from GeoJSON polygon
    const coordinates = aoi.coordinates[0]; // First ring of polygon
    
    let minLng = coordinates[0][0];
    let minLat = coordinates[0][1];
    let maxLng = coordinates[0][0];
    let maxLat = coordinates[0][1];

    for (const coord of coordinates) {
      minLng = Math.min(minLng, coord[0]);
      minLat = Math.min(minLat, coord[1]);
      maxLng = Math.max(maxLng, coord[0]);
      maxLat = Math.max(maxLat, coord[1]);
    }

    return [minLng, minLat, maxLng, maxLat];
  }

  private async getFinalResults(parcelIds: string[]): Promise<Parcel[]> {
    const { data: parcels, error } = await supabase
      .from('parcels')
      .select('*')
      .in('id', parcelIds);

    if (error) throw error;

    return (parcels || []).map(parcel => ({
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
    }));
  }
}

export const searchService = new SearchService();