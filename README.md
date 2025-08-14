# Backyard Builder Finder

A multi-tenant SaaS platform for identifying buildable space in residential backyard parcels.

## Features

- **Parcel Search**: Search by city, state, county, ZIP, address, or neighborhood
- **Buildable Area Calculation**: Compute available space after setbacks, structures, and obstacles
- **Fit Testing**: Test if target unit size fits in available space
- **Zoning Compliance**: Check lot coverage, FAR, and zoning restrictions
- **Multi-source Data**: Integrates with free/open data sources, with pluggable paid connectors
- **Filtering**: HOA presence, pools, terrain, flood zones, historic districts
- **Listing Integration**: Show current "for sale" properties for eligible parcels
- **Export Options**: CSV, GeoJSON, and PDF reports

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm 8+
- Docker and Docker Compose
- AWS CLI (for production deployment)
- Terraform (for infrastructure)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd backyard-builder-finder
   pnpm install
   ```

2. **Start local environment:**
   ```bash
   pnpm dev
   ```
   This runs `docker-compose up` which starts:
   - PostgreSQL with PostGIS
   - FastAPI backend (port 8000)
   - Next.js frontend (port 3000)
   - Redis for caching

3. **Access the application:**
   - Frontend: http://localhost:3000
   - API docs: http://localhost:8000/docs
   - Database: localhost:5432 (bbf_dev/bbf_dev)

### Project Structure

```
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # FastAPI backend
├── packages/
│   └── shared/              # Shared TypeScript types & utilities
├── infra/                   # Terraform infrastructure
├── ops/                     # CI/CD and deployment scripts
└── docs/                    # Documentation
```

## Architecture

- **Frontend**: Next.js with App Router, MapLibre GL, Tailwind CSS
- **Backend**: FastAPI with async PostgreSQL and PostGIS
- **Database**: PostgreSQL 15 with PostGIS, row-level security
- **Infrastructure**: AWS ECS, RDS, S3, CloudFront, Lambda
- **Authentication**: NextAuth.js with Google/Microsoft SSO

## Data Sources (Free/Open First)

- **Geocoding**: Nominatim (OSM) with optional paid providers
- **Parcels**: ArcGIS FeatureServer/OGC endpoints (configurable per region)
- **Buildings**: Microsoft US Building Footprints + OSM
- **Imagery**: Open tiles via MapLibre, optional paid providers with user keys
- **Listings**: RESO Web API (with user credentials) or public feeds

## Production Deployment

1. **Configure AWS credentials:**
   ```bash
   aws configure
   ```

2. **Deploy infrastructure:**
   ```bash
   pnpm infra:plan
   pnpm infra:apply
   ```

3. **Build and deploy applications:**
   ```bash
   # Triggered automatically via GitHub Actions
   git push origin main
   ```

## Environment Variables

See `.env.example` files in each app directory for required configuration.

## Legal & Compliance

- Portal scraping is **disabled by default** and requires explicit ToS acceptance
- Paid data sources require manual approval via GitHub issues
- User-provided API keys are encrypted with AWS KMS
- Audit logging for all data access and exports

## Contributing

1. Create feature branch from `main`
2. Make changes with tests
3. Commit with conventional commit format
4. Open pull request with description

## License

MIT License - see LICENSE file for details.