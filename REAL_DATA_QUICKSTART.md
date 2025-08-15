# Real Data Quick Start Guide

## ✅ Your Regrid API Key is Set Up!

Your Regrid API key has been configured and is ready to use.

## 🚀 Quick Test

1. **Test the API connection:**
   ```bash
   node scripts/test-regrid-api.js
   ```

2. **Start your development server:**
   ```bash
   npm run dev
   ```

3. **Go to Admin Panel:**
   - Navigate to `/admin` in your app
   - Check that "API Config" shows "Valid"
   - Click "Enable Real Data Mode"

## 🎯 Test Real Data Search

1. **Draw a test area:**
   - Go to the main search page
   - Draw a small polygon in Beverly Hills, CA area
   - Coordinates: around -118.40, 34.07

2. **Start search:**
   - The system will automatically fetch real parcel data
   - You'll see "Fetching real parcel data..." in the progress
   - Real parcels will be analyzed with CV and LLM

## 📊 What You'll Get

- **Real parcel boundaries** from Regrid
- **Actual addresses and APNs**
- **Current zoning information**
- **Lot sizes and property data**
- **Pool detection** from aerial imagery
- **AI analysis** for edge cases

## 💰 Cost Monitoring

Your API key includes these capabilities:
- `pa` - Parcel data
- `ts` - Tax data  
- `ps` - Property sales
- `bf` - Building footprints
- `ma` - Market analytics
- `ty` - Property types
- `eo` - Environmental overlays
- `zo` - Zoning data
- `sb` - School boundaries

Estimated costs:
- ~$0.10 per 1000 parcels from Regrid
- ~$0.01-0.05 per parcel for LLM analysis (edge cases only)

## 🔧 Configuration

Your environment is set up with:
- ✅ Regrid API Key
- ✅ NAIP Imagery URL (free USDA data)
- ⚠️  Need: Supabase credentials
- ⚠️  Need: OpenAI/Anthropic API key (for LLM analysis)

## 🎉 Next Steps

1. Run the test script to verify API connection
2. Set up your Supabase database
3. Add OpenAI or Anthropic API key for full functionality
4. Test with a small area first
5. Monitor costs and performance
6. Scale to larger areas as needed

## 🆘 Troubleshooting

If you see errors:
- **401 Unauthorized**: Check API key format
- **403 Forbidden**: Check API key permissions
- **429 Rate Limited**: Wait and retry
- **No parcels found**: Try a different area or check coordinates

Your API key expires on: **March 12, 2025**