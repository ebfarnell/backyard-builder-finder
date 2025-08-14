import { z } from 'zod';

// ========================
// GEOMETRY TYPES
// ========================

export const PointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const PolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

export const GeometrySchema = z.union([PointSchema, PolygonSchema]);

export type Point = z.infer<typeof PointSchema>;
export type Polygon = z.infer<typeof PolygonSchema>;
export type Geometry = z.infer<typeof GeometrySchema>;

// ========================
// ORGANIZATION & USER TYPES
// ========================

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  plan_tier: z.enum(['free', 'pro', 'enterprise']),
  limits: z.object({
    monthly_searches: z.number(),
    concurrent_searches: z.number(),
    max_parcels_per_search: z.number(),
    cv_operations_per_month: z.number(),
    llm_tokens_per_month: z.number(),
  }),
  created_at: z.date(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  sso_provider: z.enum(['google', 'microsoft', 'email']),
  role: z.enum(['admin', 'user', 'viewer']),
  created_at: z.date(),
});

export type Organization = z.infer<typeof OrganizationSchema>;
export type User = z.infer<typeof UserSchema>;

// ========================
// SEARCH & FILTER TYPES
// ========================

export const SetbacksSchema = z.object({
  front: z.number().min(0),
  rear: z.number().min(0),
  side: z.number().min(0),
});

export const UnitRequirementsSchema = z.object({
  area_sqft: z.number().min(100),
  width_ft: z.number().optional(),
  length_ft: z.number().optional(),
  aspect_ratio: z.number().optional(),
  rotation_allowed: z.boolean().default(true),
});

export const SearchFiltersSchema = z.object({
  // Unit requirements
  unit: UnitRequirementsSchema,
  
  // Adjustable setbacks
  setbacks: SetbacksSchema.optional(),
  
  // Zoning filters
  zoning_codes_include: z.array(z.string()).optional(),
  zoning_codes_exclude: z.array(z.string()).optional(),
  max_lot_coverage_pct: z.number().min(0).max(100).optional(),
  max_far: z.number().min(0).optional(),
  max_units: z.number().min(1).optional(),
  allow_adu: z.boolean().optional(),
  
  // Property attributes
  hoa_preference: z.enum(['include', 'exclude', 'unknown']).default('exclude'),
  pool_preference: z.enum(['include', 'exclude']).default('exclude'),
  trees_block_building: z.boolean().default(true),
  
  // Terrain and environment
  max_slope_pct: z.number().min(0).max(100).optional(),
  exclude_flood_zones: z.boolean().default(true),
  exclude_historic_districts: z.boolean().default(false),
  
  // Listing status
  listing_status: z.enum(['for_sale_only', 'include_off_market']).default('for_sale_only'),
  
  // Size filters
  min_lot_sqft: z.number().min(0).optional(),
  max_lot_sqft: z.number().optional(),
  min_buildable_sqft: z.number().min(0).optional(),
});

export const SearchAreaSchema = z.object({
  type: z.enum(['address', 'city', 'county', 'state', 'zip', 'neighborhood', 'custom_polygon']),
  value: z.string(),
  polygon: PolygonSchema.optional(),
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }).optional(),
});

export const SearchRequestSchema = z.object({
  name: z.string(),
  area: SearchAreaSchema,
  filters: SearchFiltersSchema,
  options: z.object({
    preview_only: z.boolean().default(false),
    max_parcels: z.number().min(1).max(10000).default(1000),
    enable_cv: z.boolean().default(false),
    enable_llm: z.boolean().default(true),
  }),
});

export type Setbacks = z.infer<typeof SetbacksSchema>;
export type UnitRequirements = z.infer<typeof UnitRequirementsSchema>;
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type SearchArea = z.infer<typeof SearchAreaSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

// ========================
// PARCEL & PROPERTY TYPES
// ========================

export const ZoningRulesSchema = z.object({
  code: z.string(),
  description: z.string().optional(),
  max_lot_coverage_pct: z.number().optional(),
  max_far: z.number().optional(),
  max_units: z.number().optional(),
  min_setbacks: SetbacksSchema.optional(),
  allow_adu: z.boolean().optional(),
  height_limit_ft: z.number().optional(),
  parking_required: z.number().optional(),
});

export const ParcelAttributesSchema = z.object({
  assessor_id: z.string().optional(),
  address: z.string().optional(),
  owner_name: z.string().optional(),
  lot_sqft: z.number().optional(),
  year_built: z.number().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  has_pool: z.boolean().optional(),
  has_hoa: z.boolean().optional(),
  hoa_fee: z.number().optional(),
  last_sale_price: z.number().optional(),
  last_sale_date: z.date().optional(),
  zoning_code: z.string().optional(),
  flood_zone: z.string().optional(),
  in_historic_district: z.boolean().optional(),
});

export const ParcelSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  external_id: z.string(),
  geometry: PolygonSchema,
  centroid: PointSchema,
  attributes: ParcelAttributesSchema,
  region_code: z.string(),
  updated_at: z.date(),
});

export const BuildingFootprintSchema = z.object({
  id: z.string().uuid(),
  parcel_id: z.string().uuid(),
  geometry: PolygonSchema,
  type: z.enum(['main', 'outbuilding', 'driveway']),
  source: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export const BuildableAreaSchema = z.object({
  id: z.string().uuid(),
  parcel_id: z.string().uuid(),
  version: z.string(),
  settings_hash: z.string(),
  buildable_geometry: PolygonSchema,
  area_sqft: z.number(),
  metadata: z.object({
    setbacks_applied: SetbacksSchema,
    structures_removed: z.number(),
    obstacles_removed: z.number(),
    cv_artifacts_used: z.number(),
    computation_time_ms: z.number(),
  }),
  created_at: z.date(),
});

export const FitResultSchema = z.object({
  feasible: z.boolean(),
  placement_geometry: PolygonSchema.optional(),
  rotation_degrees: z.number().optional(),
  margin_sqft: z.number().optional(),
  coverage_pct: z.number().min(0).max(100),
});

export type ZoningRules = z.infer<typeof ZoningRulesSchema>;
export type ParcelAttributes = z.infer<typeof ParcelAttributesSchema>;
export type Parcel = z.infer<typeof ParcelSchema>;
export type BuildingFootprint = z.infer<typeof BuildingFootprintSchema>;
export type BuildableArea = z.infer<typeof BuildableAreaSchema>;
export type FitResult = z.infer<typeof FitResultSchema>;

// ========================
// LISTING TYPES
// ========================

export const ListingSchema = z.object({
  id: z.string().uuid(),
  parcel_id: z.string().uuid(),
  source: z.string(),
  external_id: z.string(),
  url: z.string().url().optional(),
  price: z.number().optional(),
  status: z.enum(['active', 'pending', 'sold', 'off_market']),
  list_date: z.date().optional(),
  days_on_market: z.number().optional(),
  photos: z.array(z.string().url()).optional(),
  description: z.string().optional(),
  last_seen_at: z.date(),
});

export type Listing = z.infer<typeof ListingSchema>;

// ========================
// SEARCH RESULT TYPES
// ========================

export const ParcelResultSchema = z.object({
  parcel: ParcelSchema,
  buildable_area: BuildableAreaSchema.optional(),
  fit_result: FitResultSchema.optional(),
  zoning_rules: ZoningRulesSchema.optional(),
  listings: z.array(ListingSchema).optional(),
  warnings: z.array(z.string()).optional(),
});

export const SearchResultsSchema = z.object({
  search_id: z.string().uuid(),
  total_candidates: z.number(),
  filtered_count: z.number(),
  results: z.array(ParcelResultSchema),
  stage_timings: z.object({
    area_resolution_ms: z.number(),
    attribute_filter_ms: z.number(),
    geometry_computation_ms: z.number(),
    cv_processing_ms: z.number(),
    zoning_evaluation_ms: z.number(),
    fit_testing_ms: z.number(),
    total_ms: z.number(),
  }),
  costs: z.object({
    cv_operations: z.number(),
    llm_tokens: z.number(),
    estimated_cost_usd: z.number(),
  }),
  cache_stats: z.object({
    hits: z.number(),
    misses: z.number(),
    hit_rate_pct: z.number(),
  }),
});

export type ParcelResult = z.infer<typeof ParcelResultSchema>;
export type SearchResults = z.infer<typeof SearchResultsSchema>;

// ========================
// API RESPONSE TYPES
// ========================

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, unknown>;
};

// ========================
// EXPORT TYPES
// ========================

export const ExportRequestSchema = z.object({
  search_id: z.string().uuid(),
  type: z.enum(['csv', 'geojson', 'pdf']),
  include_geometry: z.boolean().default(true),
  include_buildable_area: z.boolean().default(true),
  include_listings: z.boolean().default(true),
});

export type ExportRequest = z.infer<typeof ExportRequestSchema>;

// ========================
// CONFIGURATION TYPES
// ========================

export const RegionConfigSchema = z.object({
  code: z.string(),
  name: z.string(),
  bounds: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }),
  data_sources: z.object({
    parcels: z.object({
      type: z.enum(['arcgis', 'ogc', 'geojson']),
      url: z.string().url(),
      layer_id: z.string().optional(),
      auth_required: z.boolean().default(false),
    }).optional(),
    zoning: z.object({
      type: z.enum(['arcgis', 'ogc', 'geojson']),
      url: z.string().url(),
      layer_id: z.string().optional(),
      auth_required: z.boolean().default(false),
    }).optional(),
    buildings: z.object({
      type: z.enum(['microsoft', 'osm', 'local']),
      path: z.string().optional(),
    }).optional(),
  }),
  default_setbacks: SetbacksSchema,
});

export type RegionConfig = z.infer<typeof RegionConfigSchema>;