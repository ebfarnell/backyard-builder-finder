import React, { createContext, useContext, useState, useCallback } from 'react';
import type { SearchFilters, SearchProgress, Parcel, Geometry } from '@shared/types';
import { api } from '@/lib/api';

interface SearchContextType {
  // Search state
  aoi: Geometry | null;
  filters: SearchFilters;
  results: Parcel[];
  progress: SearchProgress | null;
  isSearching: boolean;
  searchId: string | null;

  // Actions
  setAOI: (aoi: Geometry | null) => void;
  setFilters: (filters: SearchFilters) => void;
  startSearch: () => Promise<void>;
  clearResults: () => void;
  exportResults: (format: 'csv' | 'geojson') => Promise<void>;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

interface SearchProviderProps {
  children: React.ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [aoi, setAOI] = useState<Geometry | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    minRearSqft: 500,
    zoningCodes: [],
    hasPool: undefined,
    hoaStatus: undefined,
    lotSizeMin: undefined,
    lotSizeMax: undefined,
    lastSaleDateFrom: undefined,
    lastSaleDateTo: undefined,
  });
  const [results, setResults] = useState<Parcel[]>([]);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchId, setSearchId] = useState<string | null>(null);

  const startSearch = useCallback(async () => {
    if (!aoi) {
      throw new Error('AOI is required for search');
    }

    console.log('SearchContext: Starting search...', { aoi, filters });
    setIsSearching(true);
    setProgress(null);
    setResults([]);

    try {
      // Start the search
      const { searchId: newSearchId } = await api.startSearch({
        aoi,
        filters,
      });

      console.log('SearchContext: Search started with ID:', newSearchId);
      setSearchId(newSearchId);

      // Listen for progress updates
      const eventSource = api.createSearchProgressStream(newSearchId);
      console.log('SearchContext: Created progress stream for search:', newSearchId);

      eventSource.onmessage = (event) => {
        const progressUpdate: SearchProgress = JSON.parse(event.data);
        console.log('SearchContext: Progress update:', progressUpdate);
        setProgress(progressUpdate);

        if (progressUpdate.results) {
          console.log('SearchContext: Received results:', progressUpdate.results.length, 'parcels');
          setResults(progressUpdate.results);
        }

        if (progressUpdate.stage === 'complete' || progressUpdate.stage === 'error') {
          console.log('SearchContext: Search completed with stage:', progressUpdate.stage);
          eventSource.close();
          setIsSearching(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SearchContext: EventSource error:', error);
        eventSource.close();
        setIsSearching(false);
        setProgress({
          stage: 'error',
          processed: 0,
          total: 0,
          message: 'Connection lost',
          error: 'Failed to connect to search progress stream',
        });
      };

    } catch (error) {
      console.error('SearchContext: Search failed:', error);
      setIsSearching(false);
      setProgress({
        stage: 'error',
        processed: 0,
        total: 0,
        message: 'Search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [aoi, filters]);

  const clearResults = useCallback(() => {
    setResults([]);
    setProgress(null);
    setSearchId(null);
  }, []);

  const exportResults = useCallback(async (format: 'csv' | 'geojson') => {
    if (!searchId) {
      throw new Error('No search results to export');
    }

    const blob = await api.exportResults(searchId, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yard-qualifier-results.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [searchId]);

  const value = {
    aoi,
    filters,
    results,
    progress,
    isSearching,
    searchId,
    setAOI,
    setFilters,
    startSearch,
    clearResults,
    exportResults,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}