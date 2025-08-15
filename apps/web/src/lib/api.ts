import type { SearchRequest, Parcel, FeatureCollection } from '@shared/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new APIError(
      error.message || `HTTP ${response.status}`,
      response.status,
      error.code
    );
  }

  return response.json();
}

export const api = {
  // Search endpoints
  async startSearch(request: SearchRequest): Promise<{ searchId: string }> {
    console.log('API: Starting search with request:', {
      aoi: request.aoi,
      filters: request.filters,
      endpoint: '/api/search'
    });
    
    const result = await fetchAPI<{ searchId: string }>('/api/search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    console.log('API: Search started, received searchId:', result.searchId);
    return result;
  },

  // Server-sent events for search progress
  createSearchProgressStream(searchId: string): EventSource {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    return new EventSource(`${baseUrl}/api/search/${searchId}/progress`);
  },

  // Parcel endpoints
  async getParcel(id: string): Promise<Parcel> {
    return fetchAPI(`/api/parcel/${id}`);
  },

  // Export endpoints
  async exportResults(searchId: string, format: 'csv' | 'geojson'): Promise<Blob> {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    const response = await fetch(`${baseUrl}/api/search/${searchId}/export?format=${format}`);
    if (!response.ok) {
      throw new APIError(`Export failed: ${response.statusText}`, response.status);
    }
    return response.blob();
  },

  // Regrid proxy
  async fetchRegridData(bbox: [number, number, number, number]): Promise<FeatureCollection> {
    return fetchAPI('/api/regrid/fetch', {
      method: 'POST',
      body: JSON.stringify({ bbox }),
    });
  },

  // Health check
  async health(): Promise<{ status: string; timestamp: string }> {
    return fetchAPI('/api/health');
  },
};

export { APIError };