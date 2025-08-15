import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2, X, Target } from 'lucide-react';

interface AddressResult {
  address: string;
  lat: number;
  lon: number;
  display_name: string;
  importance?: number;
  type?: string;
}

interface AddressSearchProps {
  onAddressSelect: (result: AddressResult) => void;
  onCreateAOI?: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
}

// Geocoding service interface
interface GeocodingService {
  search: (query: string) => Promise<AddressResult[]>;
  name: string;
}

// Nominatim (OpenStreetMap) - Free geocoding service
const nominatimService: GeocodingService = {
  name: 'Nominatim',
  search: async (query: string): Promise<AddressResult[]> => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'UNFY-Property-Qualifier/1.0',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    return data.map((item: any) => ({
      address: item.display_name.split(',').slice(0, 2).join(','), // First two parts (number + street)
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      display_name: item.display_name,
      importance: item.importance,
      type: item.type,
    }));
  },
};

// Mapbox Geocoding service (requires API key)
const createMapboxService = (apiKey: string): GeocodingService => ({
  name: 'Mapbox',
  search: async (query: string): Promise<AddressResult[]> => {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${apiKey}&limit=5&types=address,poi`
    );
    
    if (!response.ok) {
      throw new Error('Mapbox geocoding request failed');
    }
    
    const data = await response.json();
    return data.features.map((feature: any) => ({
      address: feature.place_name.split(',').slice(0, 2).join(','),
      lat: feature.center[1],
      lon: feature.center[0],
      display_name: feature.place_name,
      importance: feature.relevance,
      type: feature.place_type?.[0],
    }));
  },
});

// OpenCage Geocoding service (requires API key)
const createOpenCageService = (apiKey: string): GeocodingService => ({
  name: 'OpenCage',
  search: async (query: string): Promise<AddressResult[]> => {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?key=${apiKey}&q=${encodeURIComponent(query)}&limit=5&no_annotations=1`
    );
    
    if (!response.ok) {
      throw new Error('OpenCage geocoding request failed');
    }
    
    const data = await response.json();
    return data.results.map((result: any) => ({
      address: result.formatted.split(',').slice(0, 2).join(','),
      lat: result.geometry.lat,
      lon: result.geometry.lng,
      display_name: result.formatted,
      importance: result.confidence / 10,
      type: result.components._type,
    }));
  },
});

// MapTiler Geocoding service (requires API key)
const createMapTilerService = (apiKey: string): GeocodingService => ({
  name: 'MapTiler',
  search: async (query: string): Promise<AddressResult[]> => {
    const response = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${apiKey}&limit=5`
    );
    
    if (!response.ok) {
      throw new Error('MapTiler geocoding request failed');
    }
    
    const data = await response.json();
    return data.features.map((feature: any) => ({
      address: feature.place_name.split(',').slice(0, 2).join(','),
      lat: feature.center[1],
      lon: feature.center[0],
      display_name: feature.place_name,
      importance: feature.relevance || 0.5,
      type: feature.place_type?.[0],
    }));
  },
});

export default function AddressSearch({
  onAddressSelect,
  onCreateAOI,
  placeholder = "Search for an address...",
  className = "",
}: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Choose geocoding service based on available API keys (priority order)
  const geocodingService = React.useMemo(() => {
    const mapboxKey = import.meta.env.VITE_MAPBOX_API_KEY;
    const openCageKey = import.meta.env.VITE_OPENCAGE_API_KEY;
    const mapTilerKey = import.meta.env.VITE_MAPTILER_API_KEY;
    
    // Priority order: Mapbox > OpenCage > MapTiler > Nominatim (free)
    if (mapboxKey) {
      return createMapboxService(mapboxKey);
    }
    if (openCageKey) {
      return createOpenCageService(openCageKey);
    }
    if (mapTilerKey) {
      return createMapTilerService(mapTilerKey);
    }
    return nominatimService;
  }, []);

  // Debounce search
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) return;

    console.log('Starting search for:', searchQuery);
    setLoading(true);
    setResults([]); // Clear previous results
    setError(null); // Clear previous errors
    
    try {
      console.log('Using geocoding service:', geocodingService.name);
      
      // Add a simple test for development
      if (searchQuery.toLowerCase().includes('test')) {
        console.log('Using test data');
        const testResults: AddressResult[] = [
          {
            address: '1600 Amphitheatre Parkway, Mountain View',
            lat: 37.4224764,
            lon: -122.0842499,
            display_name: '1600 Amphitheatre Parkway, Mountain View, CA, USA',
            importance: 0.9,
            type: 'address'
          },
          {
            address: '1 Apple Park Way, Cupertino',
            lat: 37.3349,
            lon: -122.009,
            display_name: '1 Apple Park Way, Cupertino, CA, USA',
            importance: 0.8,
            type: 'address'
          }
        ];
        
        setResults(testResults);
        setShowResults(true);
        setSelectedIndex(-1);
        return;
      }
      
      const searchResults = await geocodingService.search(searchQuery);
      console.log('Search results:', searchResults);
      
      if (searchResults.length > 0) {
        setResults(searchResults);
        setShowResults(true);
        setSelectedIndex(-1);
        setError(null);
      } else {
        console.log('No results found for:', searchQuery);
        setResults([]);
        setShowResults(true);
      }
    } catch (error: any) {
      console.error('Geocoding error:', error);
      setError(error.message || 'Search failed. Please try again.');
      setResults([]);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  // Manual search trigger
  const handleManualSearch = async () => {
    if (query.trim().length >= 3) {
      await performSearch(query);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualSearch();
    }
  };

  const handleResultSelect = (result: AddressResult, createAOI = false) => {
    setQuery(result.address);
    setShowResults(false);
    setResults([]);
    
    if (createAOI && onCreateAOI) {
      onCreateAOI(result);
    } else {
      onAddressSelect(result);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={resultsRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          className="w-full pl-9 pr-20 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
          placeholder={placeholder}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-1">
          {query && (
            <>
              <button
                onClick={handleManualSearch}
                disabled={query.trim().length < 3 || loading}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed mr-1 transition-colors"
                title="Search for address"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Search'}
              </button>
              <button
                onClick={clearSearch}
                className="p-1 hover:text-gray-600 transition-colors"
                title="Clear search"
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Results */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          <div className="p-2 text-xs text-gray-500 border-b">
            Found {results.length} result{results.length !== 1 ? 's' : ''} using {geocodingService.name}
          </div>
          {results.map((result, index) => (
            <div key={index} className="border-b border-gray-100 last:border-b-0">
              <div
                className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                  index === selectedIndex ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
                onClick={() => handleResultSelect(result)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {result.address}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {result.display_name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {result.lat.toFixed(4)}, {result.lon.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  {onCreateAOI && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResultSelect(result, true);
                      }}
                      className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                      title="Create AOI around this address"
                    >
                      <Target className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {showResults && !loading && error && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-red-200 rounded-lg shadow-lg p-4 text-center">
          <div className="text-red-500 text-sm font-medium mb-1">
            Search Error
          </div>
          <div className="text-xs text-red-400">
            {error}
          </div>
          <button
            onClick={() => handleManualSearch()}
            className="mt-2 px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
          >
            Try Again
          </button>
        </div>
      )}

      {/* No Results */}
      {showResults && !loading && !error && query.length >= 3 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
          <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <div className="text-sm text-gray-500">
            No addresses found for "{query}"
          </div>
          <div className="text-xs text-gray-400 mt-1 mb-2">
            Try a different search term or be more specific
          </div>
          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            💡 Tip: Try typing "test" to see sample results
          </div>
        </div>
      )}
    </div>
  );
}