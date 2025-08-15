# Real Data Setup Guide

## What We've Built

### 1. Real Data Service (`apps/api/src/services/realDataService.ts`)
- Fetches real parcel data from Regrid API
- Processes and validates data before storing
- Handles caching to avoid redundant API calls
- Provides configuration validation

### 2. Enhanced Search Service
- Automatically fetches real data when needed
- Falls back gracefully if real data fetch fails
- Maintains all existing functionality

### 3. Admin Interface (`apps/web/src/pages/AdminPage.tsx`)
- Data status monitoring
- One-click real data mode activation
- Configuration validation
- Reset to seed data option

### 4. Admin API Endpoints (`apps/api/src/routes/admin.ts`)
- `POST /api/admin/enable-real-data` - Enable real data mode
- `GET /api/admin/data-status` - Check current data status
- `POST /api/admin/fetch-area-data` - Fetch data for specific area
- `POST /api/admin/reset-to-seed-data` - Reset to seed data

## How to Use Real Data

### Step 1: Get API Keys
1. Sign up for Regrid API at https://regrid.com/
2. Get your API key
3. Set environment variable: `REGRID_API_KEY=your_key_here`

### Step 2: Enable Real Data Mode
1. Go to Admin page in the app
2. Check that API configuration is valid
3. Click "Enable Real Data Mode"
4. The system will clear seed data and start using real data

### Step 3: Test with Real Area
1. Draw an area on the map
2. Start a search
3. The system will automatically fetch real parcel data for that area
4. CV analysis will run on real aerial imagery
5. LLM analysis will provide real insights

## Data Flow

```
User draws AOI → Search starts → Check for existing parcels in area
                                        ↓
                              If < 10 parcels found
                                        ↓
                              Fetch from Regrid API → Store in database
                                        ↓
                              Continue with normal search process
```

## Cost Management

- **Regrid API**: ~$0.10 per 1000 parcels
- **NAIP Imagery**: Free (USDA public data)
- **OpenAI/Anthropic**: ~$0.01-0.05 per parcel for edge cases
- **CV Processing**: Compute costs only

## Benefits of Real Data

1. **Accurate Results**: Real property boundaries and data
2. **Current Information**: Up-to-date parcel information
3. **Scalable**: Works for any geographic area
4. **Cost-Effective**: Only fetches data when needed
5. **Cached**: Avoids redundant API calls

## Monitoring

The admin dashboard shows:
- Total parcels in database
- Data source (seed vs real)
- API configuration status
- Recent parcel additions
- System health

## Fallback Strategy

If real data fetch fails:
- System continues with existing cached data
- Logs warning but doesn't break search
- Admin can monitor and retry
- Graceful degradation ensures uptime

## Next Steps

1. Set up Regrid API key
2. Test with small area first
3. Monitor costs and performance
4. Gradually expand coverage area
5. Consider additional data sources (MLS, tax records, etc.)