# Yard Qualifier Runbook

This runbook provides step-by-step instructions for setting up, developing, testing, and deploying the Yard Qualifier application.

## 🚀 Latest Enhancement: Real Regrid API Integration (2025-08-14)

**ENHANCED**: The search service now automatically fetches real properties from the Regrid API when searching new areas!

### What Changed
- **Before**: Search only returned results if the AOI intersected with 8 seed parcels in specific LA County locations
- **After**: Search automatically fetches real parcels from Regrid API for any AOI, then analyzes them

### How It Works  
1. User draws any AOI on the map anywhere in supported areas
2. Search checks if AOI has <10 existing parcels in local database
3. If insufficient parcels, **automatically fetches from Regrid API** 
4. New parcels are inserted into database with 24h caching
5. Normal search proceeds with real property data

### Testing the Enhancement
```bash
# Test the enhanced integration with real areas
node test-regrid-integration.js
```

This tests searches in Culver City and Brentwood (outside seed parcel areas) to verify real Regrid data is fetched and analyzed.

## Prerequisites

- **Node.js**: 20.x or later
- **pnpm**: 8.x or later
- **Python**: 3.11 or later
- **Docker**: For Supabase local development
- **Git**: For version control

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd yard-qualifier

# Install dependencies
pnpm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Required variables:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - REGRID_API_KEY
# - OPENAI_API_KEY (optional)
```

### 3. Start Supabase

```bash
# Install Supabase CLI
curl -fsSL https://supabase.com/install.sh | sh

# Start Supabase services
supabase start

# This will output:
# - API URL: http://localhost:54321
# - DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323
# - Inbucket URL: http://localhost:54324
# - anon key: [your-anon-key]
# - service_role key: [your-service-role-key]
```

### 4. Database Setup

```bash
# Run migrations
supabase db push

# Seed sample data
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed.sql

# Or using Supabase CLI
supabase db reset --linked=false
```

### 5. Start Development Services

```bash
# Terminal 1: Start all services
pnpm run dev

# Or start services individually:

# Terminal 1: API Server
cd apps/api
pnpm run dev

# Terminal 2: CV Service
cd services/cv
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Terminal 3: Web App
cd apps/web
pnpm run dev
```

### 6. Access the Application

- **Web App**: http://localhost:5173
- **API Server**: http://localhost:3001
- **CV Service**: http://localhost:8000
- **Supabase Studio**: http://localhost:54323

## Testing

### Unit Tests

```bash
# Run all unit tests
pnpm run test

# Run tests for specific package
pnpm --filter web test
pnpm --filter api test
pnpm --filter shared test

# Run tests in watch mode
pnpm --filter web test --watch
```

### E2E Tests

```bash
# Install Playwright browsers
cd apps/web
npx playwright install

# Run E2E tests
pnpm run test:e2e

# Run E2E tests in headed mode
pnpm run test:e2e --headed

# Run specific test file
npx playwright test search-workflow.spec.ts
```

### Database Tests

```bash
# Run PostGIS function tests
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/tests/postgis_functions.test.sql

# Run RLS tests
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/tests/rls.test.sql
```

### Linting and Type Checking

```bash
# Run linting
pnpm run lint

# Fix linting issues
pnpm run lint --fix

# Type checking
pnpm run typecheck
```

## Building for Production

### 1. Build All Packages

```bash
# Build all packages
pnpm run build

# Build specific package
pnpm --filter web build
pnpm --filter api build
pnpm --filter shared build
```

### 2. Test Production Build

```bash
# Test web app production build
cd apps/web
pnpm run preview

# Test API server production build
cd apps/api
pnpm run start
```

## Deployment

### Render Deployment

1. **Connect Repository**:
   - Go to Render dashboard
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`

2. **Configure Environment Variables**:
   ```bash
   # Required for all services
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   
   # API-specific
   REGRID_API_KEY=your-regrid-key
   OPENAI_API_KEY=your-openai-key
   ANTHROPIC_API_KEY=your-anthropic-key
   
   # Observability
   SENTRY_DSN_WEB=your-sentry-dsn
   SENTRY_DSN_API=your-sentry-dsn
   ```

3. **Deploy Services**:
   - Render will automatically deploy all services defined in `render.yaml`
   - Monitor deployment logs for any issues

### Supabase Deployment

1. **Create Supabase Project**:
   ```bash
   # Link to existing project
   supabase link --project-ref your-project-ref
   
   # Or create new project
   supabase projects create yard-qualifier
   ```

2. **Deploy Database Changes**:
   ```bash
   # Push migrations
   supabase db push
   
   # Deploy edge functions
   supabase functions deploy llm_summarize
   ```

3. **Configure Environment Variables**:
   ```bash
   # Set secrets for edge functions
   supabase secrets set OPENAI_API_KEY=your-key
   supabase secrets set ANTHROPIC_API_KEY=your-key
   ```

## Monitoring and Maintenance

### Health Checks

```bash
# Check API health
curl https://yard-qualifier-api.onrender.com/api/health

# Check CV service health
curl https://yard-qualifier-cv.onrender.com/health

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"
```

### Log Monitoring

- **Render Logs**: Available in Render dashboard
- **Supabase Logs**: Available in Supabase dashboard
- **Sentry**: Error tracking and performance monitoring

### Database Maintenance

```bash
# Clean up old cache entries
psql $DATABASE_URL -c "SELECT cleanup_old_cache();"

# Vacuum and analyze tables
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check database size
psql $DATABASE_URL -c "
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

## Troubleshooting

### Common Issues

1. **Map Not Loading**:
   - Check CORS configuration
   - Verify MapLibre GL CSS is imported
   - Check browser console for errors

2. **Search Not Working**:
   - Verify API server is running
   - Check database connectivity
   - Verify PostGIS functions exist

3. **CV Service Errors**:
   - Check Python dependencies installed
   - Verify YOLO model downloads
   - Check NAIP imagery URLs

4. **Database Connection Issues**:
   - Verify Supabase project is running
   - Check connection string format
   - Verify RLS policies allow access

### Debug Commands

```bash
# Check service status
curl -f http://localhost:3001/api/health || echo "API down"
curl -f http://localhost:8000/health || echo "CV service down"

# Check database connection
psql $SUPABASE_URL -c "SELECT version();"

# Check PostGIS extension
psql $SUPABASE_URL -c "SELECT PostGIS_Version();"

# Test search pipeline
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "aoi": {
      "type": "Polygon",
      "coordinates": [[[-118.51,34.01],[-118.37,34.01],[-118.37,34.13],[-118.51,34.13],[-118.51,34.01]]]
    },
    "filters": {"minRearSqft": 500}
  }'
```

### Performance Optimization

1. **Database Optimization**:
   ```sql
   -- Check slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   
   -- Check index usage
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   ORDER BY idx_scan DESC;
   ```

2. **API Optimization**:
   - Monitor response times in Sentry
   - Check rate limiting effectiveness
   - Optimize database queries

3. **Frontend Optimization**:
   - Check bundle size: `pnpm --filter web run build && ls -la apps/web/dist/assets/`
   - Monitor Core Web Vitals
   - Optimize map tile loading

## Backup and Recovery

### Database Backup

```bash
# Create backup
supabase db dump --linked > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20240101.sql
```

### Configuration Backup

```bash
# Backup environment variables
cp .env .env.backup

# Backup Supabase configuration
cp supabase/config.toml supabase/config.toml.backup
```

## Security Checklist

- [ ] Environment variables are not committed to git
- [ ] RLS policies are enabled and tested
- [ ] API keys are rotated regularly
- [ ] CORS is configured correctly
- [ ] CSP headers are set
- [ ] Rate limiting is enabled
- [ ] Input validation is implemented
- [ ] Error messages don't leak sensitive data

## Support and Documentation

- **Architecture**: See `docs/ARCHITECTURE.md`
- **Rollback Procedures**: See `docs/ROLLBACK.md`
- **API Documentation**: Available at `/api/docs` when running locally
- **Database Schema**: See `supabase/migrations/`

For additional support, check:
- GitHub Issues
- Supabase Documentation
- Render Documentation
- OpenAI API Documentation