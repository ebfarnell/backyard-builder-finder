// Export all types and schemas
export * from './types';

// Export API client
export * from './api-client';

// Utility functions
export const formatArea = (sqft: number): string => {
  if (sqft < 1000) {
    return `${sqft.toLocaleString()} sq ft`;
  }
  return `${(sqft / 1000).toFixed(1)}k sq ft`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercent = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const calculateAspectRatio = (width: number, length: number): number => {
  return Math.max(width, length) / Math.min(width, length);
};

export const isValidCoordinate = (coord: [number, number]): boolean => {
  const [lng, lat] = coord;
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
};

export const bboxContainsPoint = (
  bbox: { north: number; south: number; east: number; west: number },
  point: [number, number]
): boolean => {
  const [lng, lat] = point;
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
};

// Constants
export const DEFAULT_SETBACKS = {
  front: 25,
  rear: 15,
  side: 10,
};

export const PLAN_LIMITS = {
  free: {
    monthly_searches: 10,
    concurrent_searches: 1,
    max_parcels_per_search: 100,
    cv_operations_per_month: 50,
    llm_tokens_per_month: 10000,
  },
  pro: {
    monthly_searches: 100,
    concurrent_searches: 3,
    max_parcels_per_search: 1000,
    cv_operations_per_month: 500,
    llm_tokens_per_month: 100000,
  },
  enterprise: {
    monthly_searches: 1000,
    concurrent_searches: 10,
    max_parcels_per_search: 10000,
    cv_operations_per_month: 5000,
    llm_tokens_per_month: 1000000,
  },
};

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Insufficient permissions',
  NOT_FOUND: 'Resource not found',
  RATE_LIMITED: 'Rate limit exceeded',
  QUOTA_EXCEEDED: 'Monthly quota exceeded',
  INVALID_REGION: 'Region not supported',
  PROCESSING_ERROR: 'Processing failed',
  EXTERNAL_API_ERROR: 'External service unavailable',
};