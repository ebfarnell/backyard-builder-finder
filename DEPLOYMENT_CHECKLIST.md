# 🚀 Deployment Checklist

## ✅ Pre-Deployment Verification

### 1. Configuration Status
- ✅ **Regrid API Key**: Configured in render.yaml
- ✅ **NAIP Template URL**: Configured for aerial imagery
- ✅ **Real Data Service**: Implemented and integrated
- ✅ **Admin Interface**: Ready for data management
- ⚠️  **Supabase**: Need to verify database connection
- ⚠️  **LLM Keys**: Optional but recommended for full functionality

### 2. Code Changes Ready
- ✅ Real data service (`apps/api/src/services/realDataService.ts`)
- ✅ Enhanced search service with real data integration
- ✅ Admin routes for data management (`apps/api/src/routes/admin.ts`)
- ✅ Updated admin page with data controls
- ✅ Fixed render.yaml configuration issues

## 🎯 Deployment Steps

### Option 1: Render.com Auto-Deploy
If you have auto-deploy enabled:
1. **Commit and push your changes**:
   ```bash
   git add .
   git commit -m "feat: integrate real data from Regrid API"
   git push origin main
   ```
2. **Monitor deployment** in Render dashboard
3. **Check logs** for any build/startup issues

### Option 2: Manual Deploy via Render Dashboard
1. Go to your Render dashboard
2. Select your services
3. Click "Manual Deploy" → "Deploy latest commit"
4. Monitor build logs

### Option 3: Render CLI (if installed)
```bash
render deploy
```

## 🔍 Post-Deployment Testing

### 1. Health Checks
Visit these URLs to verify services are running:
- **API Health**: `https://yard-qualifier-api.onrender.com/api/health`
- **CV Health**: `https://yard-qualifier-cv.onrender.com/health`
- **Web App**: `https://yard-qualifier-web.onrender.com`

### 2. Real Data Integration Test
1. **Go to Admin Panel**: `https://yard-qualifier-web.onrender.com/admin`
2. **Check API Config**: Should show "Valid" with Regrid key detected
3. **Enable Real Data Mode**: Click the button
4. **Test Search**: Draw area in Beverly Hills, CA and search
5. **Verify Real Data**: Check that parcels have real addresses/APNs

### 3. Expected Behavior
When searching a new area, you should see:
```
Stage 1: "Fetching real parcel data and filtering by criteria..."
Stage 2: "Analyzing imagery for pool detection..."
Stage 3: "AI analysis for edge cases..." (if LLM key configured)
Stage 4: "Analysis complete. X parcels qualify."
```

## 🚨 Troubleshooting

### Common Deployment Issues

#### Build Failures
- **pnpm not found**: Render should auto-detect pnpm from lockfile
- **TypeScript errors**: Check for any remaining type issues
- **Missing dependencies**: Verify package.json includes all deps

#### Runtime Issues
- **Environment variables**: Check Render dashboard env vars
- **Database connection**: Verify Supabase credentials
- **API key format**: Regrid JWT token should work as-is

#### Real Data Issues
- **"No parcels found"**: Try different geographic area
- **"API Config Invalid"**: Check environment variables in Render
- **"Rate limit exceeded"**: Normal - wait and retry

### Debug Commands
Check logs in Render dashboard or via CLI:
```bash
render logs --service yard-qualifier-api --tail
render logs --service yard-qualifier-cv --tail
```

## 📊 Monitoring Real Data Usage

### After Deployment
1. **Monitor API calls** in Render logs
2. **Check Regrid usage** in their dashboard
3. **Track costs** via admin panel
4. **Verify data quality** with test searches

### Success Indicators
- ✅ Admin panel shows "Valid" API config
- ✅ Search logs show "Fetching from Regrid API"
- ✅ Results contain real addresses and APNs
- ✅ Map displays actual property boundaries
- ✅ No 401/403 errors in logs

## 🎉 Go Live!

Once deployed and tested:
1. **Share the live URL**: `https://yard-qualifier-web.onrender.com`
2. **Monitor initial usage** and performance
3. **Scale up** if needed (upgrade Render plans)
4. **Add monitoring** (Sentry, etc.) for production use

## 🔧 Environment Variables Needed

Make sure these are set in Render dashboard:

### Required
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` 
- `SUPABASE_ANON_KEY`
- `REGRID_API_KEY` ✅ (already configured)

### Optional but Recommended
- `OPENAI_API_KEY` (for LLM analysis)
- `ANTHROPIC_API_KEY` (alternative to OpenAI)
- `SENTRY_DSN_API` (error monitoring)

Your app is ready to deploy with real data integration! 🚀