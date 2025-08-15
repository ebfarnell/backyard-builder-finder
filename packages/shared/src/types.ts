import { z } from 'zod';

// Geometry types with proper coordinate typing
export const GeometrySchema = z.object({
  type: z.enum(['Point', 'LineString', 'Polygon', 'MultiPolygon']),
  coordinates: z.array(z.any()), // Keep flexible for compatibility
});

export const FeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: GeometrySchema,
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const FeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(FeatureSchema),
});

export type Geometry = z.infer<typeof GeometrySchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type FeatureCollection = z.infer<typeof FeatureCollectionSchema>;

// Search filters
export const SearchFiltersSchema = z.object({
  lotSizeMin: z.number().optional(),
  lotSizeMax: z.number().optional(),
  zoningCodes: z.array(z.string()).optional(),
  hasPool: z.boolean().optional(),
  hoaStatus: z.enum(['unknown', 'yes', 'no']).optional(),
  lastSaleDateFrom: z.string().optional(),
  lastSaleDateTo: z.string().optional(),
  minRearSqft: z.number().default(100),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

// Search request
export const SearchRequestSchema = z.object({
  aoi: GeometrySchema,
  filters: SearchFiltersSchema,
  userId: z.string().optional(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

// Parcel data
export const ParcelSchema = z.object({
  id: z.string(),
  apn: z.string(),
  address: z.string().nullable(),
  geometry: GeometrySchema,
  lotArea: z.number(),
  zoningCode: z.string().nullable(),
  lastSalePrice: z.number().nullable(),
  lastSaleDate: z.string().nullable(),
  rearFreeSqft: z.number().nullable(),
  hasPool: z.boolean().nullable(),
  qualifies: z.boolean().nullable(),
  rationale: z.string().nullable(),
  hoaStatus: z.enum(['unknown', 'yes', 'no']).default('unknown'),
});

export type Parcel = z.infer<typeof ParcelSchema>;

// Search progress
export const SearchProgressSchema = z.object({
  stage: z.enum(['starting', 'sql_filter', 'cv_analysis', 'llm_analysis', 'complete', 'error']),
  processed: z.number(),
  total: z.number(),
  message: z.string(),
  results: z.array(ParcelSchema).optional(),
  error: z.string().optional(),
});

export type SearchProgress = z.infer<typeof SearchProgressSchema>;

// CV Detection
export const CVDetectionSchema = z.object({
  id: z.string(),
  parcelId: z.string(),
  kind: z.enum(['pool', 'building']),
  geometry: GeometrySchema,
  confidence: z.number(),
  createdAt: z.string(),
});

export type CVDetection = z.infer<typeof CVDetectionSchema>;

// API Usage
export const APIUsageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  searchId: z.string(),
  provider: z.string(),
  model: z.string(),
  tokensUsed: z.number(),
  cost: z.number(),
  createdAt: z.string(),
});

export type APIUsage = z.infer<typeof APIUsageSchema>;

// User API Keys
export const UserAPIKeySchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: z.enum(['openai', 'anthropic']),
  keyHash: z.string(),
  isEncrypted: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
});

export type UserAPIKey = z.infer<typeof UserAPIKeySchema>;

// LLM Providers
export type LLMProvider = 'openai' | 'anthropic';

export const LLMRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
});

export type LLMRequest = z.infer<typeof LLMRequestSchema>;

// Error types
export class YardQualifierError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'YardQualifierError';
  }
}

export class ValidationError extends YardQualifierError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class RateLimitError extends YardQualifierError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
  }
}

export class BudgetExceededError extends YardQualifierError {
  constructor(message: string = 'Budget exceeded') {
    super(message, 'BUDGET_EXCEEDED', 402);
  }
}