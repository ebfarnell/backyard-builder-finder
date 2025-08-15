# Yard Qualifier Architecture

## Overview

Yard Qualifier is a full-stack application that uses AI and computer vision to analyze real estate parcels for rear yard qualification. The system processes geospatial data, aerial imagery, and applies machine learning models to determine if properties meet specific rear yard requirements.

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Server    │    │   CV Service    │
│   (React/Vite)  │◄──►│   (Fastify)     │◄──►│   (FastAPI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MapLibre GL   │    │   Supabase      │    │   YOLOv8n       │
│   (Mapping)     │    │   (PostGIS)     │    │   (Pool Det.)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                                ▼
                       ┌─────────────────┐
                       │  Edge Functions │
                       │  (LLM Proxy)    │
                       └─────────────────┘
```

## Components

### Frontend (React + TypeScript + Vite)
- **Location**: `apps/web/`
- **Purpose**: User interface for drawing AOI, setting filters, viewing results
- **Key Features**:
  - Interactive map with drawing tools (MapLibre GL + Mapbox Draw)
  - Real-time search progress via Server-Sent Events
  - Results visualization with export capabilities
  - Settings page for API key management
  - Admin dashboard for usage monitoring

### API Server (Node.js + Fastify)
- **Location**: `apps/api/`
- **Purpose**: Main backend service orchestrating the search pipeline
- **Key Features**:
  - Staged filtering pipeline (SQL → CV → LLM)
  - MVT vector tile generation for map display
  - Regrid API proxy with caching
  - Rate limiting and usage tracking
  - Server-Sent Events for progress updates

### CV Service (Python + FastAPI)
- **Location**: `services/cv/`
- **Purpose**: Computer vision analysis for pool detection
- **Key Features**:
  - YOLOv8n model for object detection
  - NAIP imagery fetching and processing
  - Result caching with TTL
  - Geometric analysis and IoU calculations

### Database (Supabase + PostGIS)
- **Location**: `supabase/`
- **Purpose**: Geospatial data storage and processing
- **Key Features**:
  - PostGIS functions for rear yard estimation
  - Row Level Security (RLS) policies
  - MVT tile generation
  - Caching layers for external APIs

### Edge Functions (Supabase + TypeScript)
- **Location**: `supabase/functions/`
- **Purpose**: LLM proxy with provider abstraction
- **Key Features**:
  - OpenAI and Anthropic integration
  - Token budgeting and cost tracking
  - Feature flags for provider selection

## Data Flow

### Search Pipeline

1. **User Input**: User draws AOI and sets filters
2. **Stage A - SQL Filtering**:
   - Query parcels within AOI
   - Apply basic filters (lot size, zoning, etc.)
   - Calculate rear yard free area using PostGIS
   - Filter by minimum rear yard requirement
3. **Stage B - CV Analysis**:
   - Check cache for existing pool detections
   - Fetch NAIP imagery for uncached parcels
   - Run YOLOv8n pool detection
   - Update parcel records with pool status
4. **Stage C - LLM Analysis**:
   - Identify edge cases (near threshold, approximate calculations)
   - Call LLM service for qualification analysis
   - Apply budget constraints ($1 per search)
   - Update parcels with qualification status and rationale
5. **Results**: Return qualified parcels with full analysis

### Real-time Updates

- Server-Sent Events stream progress to frontend
- Each stage reports processed/total counts
- Results are incrementally available
- Error handling with graceful degradation

## Security

### Authentication & Authorization
- Supabase Auth for user management
- Row Level Security (RLS) on all user-scoped tables
- Service role key for backend operations only

### API Security
- CORS restrictions to allowed origins
- Rate limiting per user/IP
- Input validation with Zod schemas
- CSP headers and security middleware

### Data Protection
- API keys encrypted at rest (optional)
- Session-only storage by default
- 90-day retention for encrypted keys
- No PII in logs or error messages

## Deployment

### Render Configuration
- **Static Site**: Frontend build artifacts
- **Web Services**: API server and CV service
- **Environment Variables**: Managed through Render dashboard
- **Health Checks**: `/health` endpoints for all services

### CI/CD Pipeline
- **Type Checking**: TypeScript strict mode
- **Linting**: ESLint with React and TypeScript rules
- **Unit Tests**: Vitest for business logic
- **E2E Tests**: Playwright for user workflows
- **Bundle Analysis**: Size limits enforced
- **Security Scanning**: Trivy for vulnerabilities

## Performance Considerations

### Caching Strategy
- **CV Detections**: 7-day TTL to avoid reprocessing
- **Regrid Data**: 24-hour TTL for parcel data
- **MVT Tiles**: 1-hour cache headers
- **LLM Results**: Permanent storage for analysis

### Optimization
- **Database Indexes**: GIST for geometry, B-tree for common queries
- **Bundle Splitting**: Vendor and map libraries separated
- **Image Processing**: Tile-based approach for large areas
- **Rate Limiting**: Prevents abuse and manages costs

## Monitoring & Observability

### Error Tracking
- **Sentry**: Frontend and backend error monitoring
- **Logflare**: Edge function logs
- **Structured Logging**: JSON format with correlation IDs

### Metrics
- **Usage Dashboard**: Search counts, costs, durations
- **Performance Monitoring**: API response times
- **Cache Hit Rates**: CV and Regrid cache effectiveness
- **Budget Tracking**: LLM token usage and costs

## Scalability

### Horizontal Scaling
- **Stateless Services**: API and CV services can scale independently
- **Database**: Supabase handles scaling automatically
- **Caching**: Redis could be added for distributed caching

### Performance Limits
- **Max Parcels**: 10,000 per search (configurable)
- **LLM Budget**: $1 per search (configurable)
- **Rate Limits**: 10 searches per hour per user (configurable)
- **Concurrent Searches**: Limited by service capacity

## Future Enhancements

### Model Improvements
- **Custom Pool Detection**: Fine-tune YOLOv8 on pool-specific imagery
- **Building Footprint Detection**: Automated building extraction
- **Zoning Analysis**: LLM-based zoning compliance checking

### Data Sources
- **Nationwide Coverage**: Expand beyond LA County pilot
- **Real Estate Listings**: Integration with MLS data
- **Permit Data**: Building permits and HOA information

### User Experience
- **Mobile App**: React Native or PWA
- **Saved Searches**: User accounts with search history
- **Notifications**: Email alerts for new qualifying properties