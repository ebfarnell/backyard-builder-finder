import type {
  ApiResponse,
  SearchRequest,
  SearchResults,
  Parcel,
  ExportRequest,
  Organization,
  User,
  RegionConfig,
} from './types';

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAuthToken = config.getAuthToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // ========================
  // SEARCH ENDPOINTS
  // ========================

  async resolveSearchArea(area: SearchRequest['area']): Promise<ApiResponse<{
    polygon: any;
    bounds: { north: number; south: number; east: number; west: number };
    metadata: Record<string, unknown>;
  }>> {
    return this.request('/search/area', {
      method: 'POST',
      body: JSON.stringify({ area }),
    });
  }

  async previewSearch(request: SearchRequest): Promise<ApiResponse<{
    estimated_parcels: number;
    estimated_cost_usd: number;
    estimated_time_minutes: number;
    warnings: string[];
  }>> {
    return this.request('/search/preview', {
      method: 'POST',
      body: JSON.stringify({ ...request, options: { ...request.options, preview_only: true } }),
    });
  }

  async executeSearch(request: SearchRequest): Promise<ApiResponse<SearchResults>> {
    return this.request('/search/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSearchStatus(searchId: string): Promise<ApiResponse<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress_pct: number;
    current_stage: string;
    results_so_far: number;
    estimated_completion: string;
  }>> {
    return this.request(`/search/${searchId}/status`);
  }

  async getSearchResults(searchId: string, page = 1, limit = 50): Promise<ApiResponse<SearchResults>> {
    return this.request(`/search/${searchId}/results?page=${page}&limit=${limit}`);
  }

  // ========================
  // PARCEL ENDPOINTS
  // ========================

  async getParcel(parcelId: string): Promise<ApiResponse<{
    parcel: Parcel;
    buildable_area: any;
    fit_result: any;
    zoning_rules: any;
    listings: any[];
    nearby_parcels: Parcel[];
  }>> {
    return this.request(`/parcels/${parcelId}`);
  }

  async recomputeBuildableArea(
    parcelId: string,
    options: {
      setbacks?: { front: number; rear: number; side: number };
      include_trees?: boolean;
      enable_cv?: boolean;
    }
  ): Promise<ApiResponse<{ buildable_area: any; fit_result: any }>> {
    return this.request(`/parcels/${parcelId}/buildable`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // ========================
  // EXPORT ENDPOINTS
  // ========================

  async createExport(request: ExportRequest): Promise<ApiResponse<{
    export_id: string;
    download_url: string;
    expires_at: string;
  }>> {
    return this.request('/exports', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getExport(exportId: string): Promise<ApiResponse<{
    status: 'pending' | 'completed' | 'failed';
    download_url?: string;
    expires_at?: string;
    error?: string;
  }>> {
    return this.request(`/exports/${exportId}`);
  }

  // ========================
  // USER & ORG ENDPOINTS
  // ========================

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request('/auth/me');
  }

  async getOrganization(): Promise<ApiResponse<Organization>> {
    return this.request('/auth/organization');
  }

  async updateUserApiKeys(keys: {
    openai_key?: string;
    anthropic_key?: string;
    mapbox_key?: string;
    google_key?: string;
  }): Promise<ApiResponse<{ updated: string[] }>> {
    return this.request('/auth/api-keys', {
      method: 'PUT',
      body: JSON.stringify(keys),
    });
  }

  // ========================
  // ADMIN ENDPOINTS
  // ========================

  async getRegions(): Promise<ApiResponse<RegionConfig[]>> {
    return this.request('/admin/regions');
  }

  async updateRegionConfig(regionCode: string, config: RegionConfig): Promise<ApiResponse<RegionConfig>> {
    return this.request(`/admin/regions/${regionCode}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async ingestParcels(regionCode: string, options?: {
    force_refresh?: boolean;
    tile_bounds?: { north: number; south: number; east: number; west: number };
  }): Promise<ApiResponse<{
    job_id: string;
    estimated_duration_minutes: number;
  }>> {
    return this.request(`/admin/ingest/parcels`, {
      method: 'POST',
      body: JSON.stringify({ region_code: regionCode, ...options }),
    });
  }

  async getHealth(): Promise<ApiResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    database: { status: string; connection_count: number };
    cache: { status: string; hit_rate_pct: number };
    external_apis: Record<string, { status: string; last_check: string }>;
  }>> {
    return this.request('/admin/health');
  }

  async getMetrics(): Promise<ApiResponse<{
    searches_24h: number;
    active_searches: number;
    cache_hit_rate_pct: number;
    avg_response_time_ms: number;
    error_rate_pct: number;
    costs_24h_usd: number;
  }>> {
    return this.request('/admin/metrics');
  }

  async clearCache(cacheType?: 'parcels' | 'zoning' | 'geocoding' | 'all'): Promise<ApiResponse<{
    cleared: string[];
    cache_size_before: number;
    cache_size_after: number;
  }>> {
    const params = cacheType ? `?type=${cacheType}` : '';
    return this.request(`/admin/cache/clear${params}`, {
      method: 'POST',
    });
  }

  // ========================
  // UTILITY METHODS
  // ========================

  async geocode(address: string): Promise<ApiResponse<{
    candidates: Array<{
      address: string;
      coordinates: [number, number];
      confidence: number;
      bounds?: { north: number; south: number; east: number; west: number };
    }>;
  }>> {
    return this.request('/utilities/geocode', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  async reverseGeocode(coordinates: [number, number]): Promise<ApiResponse<{
    address: string;
    city: string;
    county: string;
    state: string;
    zip: string;
  }>> {
    return this.request('/utilities/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ coordinates }),
    });
  }
}

// Default client factory for use in Next.js with Supabase
export const createApiClient = (baseUrl?: string) => {
  return new ApiClient({
    baseUrl: baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    getAuthToken: async () => {
      if (typeof window !== 'undefined') {
        // Client-side: get from Supabase session
        try {
          const { createSupabaseComponentClient } = await import('@supabase/auth-helpers-nextjs');
          const supabase = createSupabaseComponentClient();
          const { data: { session } } = await supabase.auth.getSession();
          return session?.access_token || null;
        } catch (error) {
          console.warn('Failed to get Supabase token:', error);
          return null;
        }
      }
      return null;
    },
  });
};