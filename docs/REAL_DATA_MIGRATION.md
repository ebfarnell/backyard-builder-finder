# Real Data Migration Guide

## Overview
This guide explains how to transition from seed data to real property data using external APIs.

## Data Sources

### 1. Regrid API (Primary Parcel Data)
- **Purpose**: Real parcel boundaries, APNs, addresses, zoning
- **API**: Already integrated in `apps/api/src/routes/regrid.ts`
- **Cost**: ~$0.10 per 1000 parcels
- **Setup**: Add your `REGRID_API_KEY` to environment variables

### 2. NAIP Imagery (Aerial Photos)
- **Purpose**: High-resolution aerial imagery for CV analysis
- **Source**: USDA National Agriculture Imagery Program
- **Cost**: Free (public data)
- **Already configured**: `NAIP_TEMPLATE_URL` in config

### 3. Computer Vision Service
- **Purpose**: Pool detection from aerial imagery
- **Implementation**: `services/cv/` directory
- **Models**: YOLOv8 for object detection

## Migration Steps

### Phase 1: Enable Real Parcel Data
1. Get Regrid API key from https://regrid.com/
2. Set `REGRID_API_KEY` environment variable
3. Test with small area first

### Phase 2: Real-time Data Pipeline
1. Remove seed data dependency
2. Enable dynamic parcel fetching
3. Implement data caching strategy

### Phase 3: Production Optimization
1. Add data validation
2. Implement error handling
3. Set up monitoring

## Implementation Plan

### Step 1: Create Real Data Service
```typescript
// apps/api/src/services/realDataService.ts
export class RealDataService {
  async fetchParcelsForArea(aoi: Geometry): Promise<Parcel[]> {
    // Fetch from Regrid API
    // Process and validate data
    // Store in database
  }
}
```

### Step 2: Update Search Service
- Modify to fetch real data on-demand
- Add caching layer for performance
- Handle API rate limits

### Step 3: Data Quality Assurance
- Validate parcel geometries
- Check for missing required fields
- Handle API failures gracefully

## Cost Estimation (per 1000 searches)
- Regrid API: ~$10-50 (depending on area size)
- OpenAI/Anthropic: ~$5-20 (for edge cases)
- NAIP imagery: Free
- CV processing: Compute costs only

## Recommended Approach
Start with a small geographic area (e.g., single zip code) to:
1. Test API integrations
2. Validate data quality
3. Optimize performance
4. Estimate costs

Then gradually expand coverage area.