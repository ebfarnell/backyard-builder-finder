# Yard Qualifier

AI-powered rear yard qualification system for real estate parcels using computer vision and LLM analysis.

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind + MapLibre GL JS
- **API**: Node.js + Fastify for parcel search, MVT tiles, Regrid proxy
- **CV Service**: Python + FastAPI + YOLOv8n for pool detection
- **Database**: Supabase Postgres + PostGIS with RLS
- **Edge Functions**: Supabase TypeScript for LLM proxy
- **Deployment**: Render (Static SPA + Web Services)

## Features

- **Geospatial Search**: Draw AOI or select by city/ZIP
- **Staged Filtering**: SQL → Computer Vision → LLM analysis
- **Pool Detection**: YOLOv8n on NAIP imagery
- **Rear Yard Analysis**: PostGIS-based geometric heuristics
- **Multi-Provider LLM**: OpenAI (default) + Anthropic (optional)
- **Export**: CSV + GeoJSON with full analysis results
- **Real-time Progress**: Server-sent events for search status

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Start Supabase (requires Docker)
npx supabase start

# Run migrations
pnpm run db:migrate

# Seed sample data
pnpm run db:seed

# Start all services
pnpm run dev
```

Visit http://localhost:5173 to access the application.

## Development

- **Web App**: http://localhost:5173
- **API Server**: http://localhost:3001
- **CV Service**: http://localhost:8000
- **Supabase Studio**: http://localhost:54323

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Linting
pnpm run lint

# Type checking
pnpm run typecheck
```

## Deployment

See `docs/ROLLBACK.md` for deployment and rollback procedures.

## License

MIT