# Backyard Builder Finder - Netlify Deployment Instructions

## 🚀 Manual Deployment via Netlify Dashboard

Since the Netlify CLI is having issues with our monorepo structure, here are the manual deployment steps:

### Step 1: Access Netlify Dashboard
1. Go to https://app.netlify.com
2. Sign in with your account (ebfarnell@gmail.com)

### Step 2: Create New Site
1. Click "Add new site" → "Import an existing project"
2. Choose "Deploy with GitHub"
3. Select the repository: `ebfarnell/backyard-builder-finder`

### Step 3: Configure Build Settings
Netlify should automatically detect the `netlify.toml` configuration, but verify these settings:

**Build Settings:**
- **Base directory:** `(leave empty)`
- **Build command:** `cd apps/web && npm ci && npm run build`
- **Publish directory:** `apps/web/out`

### Step 4: Environment Variables
Add these environment variables in Netlify settings:

```env
NODE_ENV=production
NEXT_PUBLIC_NODE_ENV=production
NEXT_PUBLIC_API_URL=https://backyard-builder-finder-api.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://jgmiixdkhbmaeeoniajh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbWlpeGRraGJtYWVlb25pYWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDM1OTMsImV4cCI6MjA3MDcxOTU5M30.WB7Xqns_rHM_d4in52mldMQ2AAx5vMILLUaKrZ35U9s
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
```

### Step 5: Deploy
1. Click "Deploy site"
2. Wait for build to complete (usually 2-3 minutes)
3. Your site will be available at the generated URL

### Step 6: Custom Domain (Optional)
1. Go to Site settings → Domain management
2. Add custom domain: `backyard-builder-finder.netlify.app`

## ✅ Expected Results

After successful deployment:
- **Frontend URL:** https://[site-name].netlify.app
- **Login/Signup:** Working with Supabase Auth
- **API Connection:** Connected to Render backend
- **Database:** Connected to Supabase PostgreSQL

## 🔧 Troubleshooting

### Build Failures
If the build fails, check:
1. **Node.js version** - Ensure Node 18+ is being used
2. **Build command** - Verify `cd apps/web && npm ci && npm run build`
3. **Dependencies** - Check package.json for missing dependencies

### Runtime Errors
If the app loads but has errors:
1. **Environment variables** - Verify all NEXT_PUBLIC_ vars are set
2. **API connection** - Check if Render backend is running
3. **CORS issues** - Verify backend allows Netlify domain

## 📊 Deployment Status

- ✅ **Repository:** Ready with latest code
- ✅ **Configuration:** netlify.toml configured
- ✅ **Environment:** Production variables ready
- ✅ **Dependencies:** All packages updated
- ✅ **Build:** Next.js configured for static export

## 🎯 Next Steps After Deployment

1. **Test Authentication:** Sign up and login functionality
2. **Test API Integration:** Dashboard loads user profile
3. **Mobile Testing:** Responsive design on mobile devices
4. **Performance:** Check loading times and optimization

---

**GitHub Repository:** https://github.com/ebfarnell/backyard-builder-finder
**Backend API:** https://backyard-builder-finder-api.onrender.com
**Database:** Supabase PostgreSQL with PostGIS