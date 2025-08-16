import { useState, useEffect } from 'react';
import { Play, Download, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import MapComponent from '@/components/Map/MapComponent';
import SearchFilters from '@/components/Search/SearchFilters';
import SearchProgress from '@/components/Search/SearchProgress';
import ResultsList from '@/components/Search/ResultsList';
import { useSearch } from '@/contexts/SearchContext';
// import { useToast } from '@/components/ui/Toaster';
import { api } from '@/lib/api';
import type { Parcel, FeatureCollection } from '@shared/types';

export default function HomePage() {
  const {
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
  } = useSearch();

  // const { addToast } = useToast();
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [selectedAddressParcel, setSelectedAddressParcel] = useState<FeatureCollection | null>(null);
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(false);

  // Auto-trigger search when AOI is drawn (if enabled)
  useEffect(() => {
    if (aoi && autoSearchEnabled && !isSearching) {
      console.log('AOI detected, auto-triggering search...');
      const autoSearch = async () => {
        try {
          console.log('Starting auto-search with AOI:', aoi);
          await startSearch();
        } catch (error) {
          console.error('Auto-search failed:', error instanceof Error ? error.message : 'Unknown error occurred');
        }
      };
      autoSearch();
    }
  }, [aoi, autoSearchEnabled, isSearching, startSearch]);

  const handleStartSearch = async () => {
    if (!aoi) {
      console.warn('Area Required: Please draw an area on the map before searching');
      return;
    }

    try {
      console.log('Starting search with AOI:', aoi);
      await startSearch();
    } catch (error) {
      console.error('Search Failed:', error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const handleExport = async (format: 'csv' | 'geojson') => {
    try {
      await exportResults(format);
      console.log('Export Complete:', `Results exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export Failed:', error instanceof Error ? error.message : 'Export failed');
    }
  };


  const resetFilters = () => {
    setFilters({ 
      minRearSqft: 500,
      zoningCodes: [],
      hasPool: undefined,
      hoaStatus: undefined,
      lotSizeMin: undefined,
      lotSizeMax: undefined,
      lastSaleDateFrom: undefined,
      lastSaleDateTo: undefined,
    });
  };

  // Debug function to test API connection
  const testAPIConnection = async () => {
    try {
      console.log('Testing API connection...');
      const health = await fetch('/api/health').then(r => r.json());
      console.log('API Health:', health);
      
      // Test with a simple Beverly Hills polygon
      const testAOI = {
        type: 'Polygon' as const,
        coordinates: [[
          [-118.4161, 34.0901],
          [-118.3901, 34.0901], 
          [-118.3901, 34.0661],
          [-118.4161, 34.0661],
          [-118.4161, 34.0901]
        ]]
      };
      
      console.log('Testing search with Beverly Hills area...');
      const result = await api.startSearch({
        aoi: testAOI,
        filters: { minRearSqft: 500, zoningCodes: [], hasPool: undefined, hoaStatus: undefined }
      });
      console.log('Test search result:', result);
    } catch (error) {
      console.error('API Test failed:', error);
    }
  };

  return (
    <div className="h-full flex">
      {/* Left Panel */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Yard Qualifier</h2>
          <p className="text-sm text-gray-600 mt-1">
            Find parcels with qualifying rear yards
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-6">
            {/* AOI Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Area of Interest</h3>
                <label className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoSearchEnabled}
                    onChange={(e) => setAutoSearchEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span>Auto-search</span>
                </label>
              </div>
              {aoi ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-green-700">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Area defined</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAOI(null)}
                      className="text-green-700 hover:text-green-800 hover:bg-green-100"
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {autoSearchEnabled ? 'Auto-search will trigger when area is drawn' : 'Ready to search within selected area'}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Select search area</p>
                    <p className="text-xs text-blue-600">
                      Use the drawing tools on the map to define your search area:
                    </p>
                    <ul className="text-xs text-blue-600 mt-1 space-y-0.5 ml-2">
                      <li>• Draw polygon for custom areas</li>
                      <li>• Draw rectangle for simple regions</li>
                      <li>• Import/export GeoJSON files</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Address Parcel */}
            {selectedAddressParcel && selectedAddressParcel.features.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-sm text-yellow-800">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">Selected Address</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAddressParcel(null)}
                    className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100"
                  >
                    Clear
                  </Button>
                </div>
                {(() => {
                  const parcel = selectedAddressParcel.features[0];
                  const props = parcel.properties || {};
                  
                  return (
                    <div className="space-y-2">
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">
                          {props.saddno && props.saddstr 
                            ? `${props.saddno} ${props.saddstr}`.trim()
                            : props.parcelnumb || props.ll_gissid || 'Unknown Address'
                          }
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs text-yellow-700">
                        {props.parcelnumb && (
                          <div>
                            <span className="font-medium">APN:</span> {props.parcelnumb}
                          </div>
                        )}
                        {props.shape_area && (
                          <div>
                            <span className="font-medium">Lot Size:</span> {new Intl.NumberFormat('en-US').format(Math.round(Number(props.shape_area)))} sq ft
                          </div>
                        )}
                        {props.zoning && (
                          <div>
                            <span className="font-medium">Zoning:</span> {props.zoning}
                          </div>
                        )}
                        {props.county && (
                          <div>
                            <span className="font-medium">County:</span> {props.county}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded">
                        <p className="font-medium">Property Information</p>
                        <p>This property data is retrieved from Regrid API. Use the search tools above to analyze this property's qualification for yard expansion projects.</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Search Filters */}
            <SearchFilters
              filters={filters}
              onChange={setFilters}
              onReset={resetFilters}
            />

            {/* Search Button */}
            <Button
              onClick={handleStartSearch}
              disabled={!aoi || isSearching}
              loading={isSearching}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {isSearching ? 'Searching...' : 'Start Search'}
            </Button>

            {/* Search Progress */}
            {progress && <SearchProgress progress={progress} />}
            
            {/* Search Debug Info */}
            {(isSearching || progress) && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Search Status</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1">
                  <div>State: {isSearching ? 'Searching...' : 'Idle'}</div>
                  <div>Search ID: {searchId || 'None'}</div>
                  <div>Progress: {progress?.stage || 'None'}</div>
                  <div>Results: {results.length} parcels</div>
                  {progress?.error && <div className="text-red-600">Error: {progress.error}</div>}
                </div>
              </div>
            )}

            {/* Debug Tools */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Debug Tools</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={testAPIConnection}
                className="w-full text-xs"
              >
                Test API Connection
              </Button>
            </div>

            {/* Export Controls */}
            {results.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Export Results</h3>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('csv')}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('geojson')}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    GeoJSON
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearResults}
                  className="w-full"
                >
                  Clear Results
                </Button>
              </div>
            )}

            {/* Results List */}
            <ResultsList
              results={results}
              onParcelSelect={setSelectedParcel}
              selectedParcelId={selectedParcel?.id}
            />
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapComponent 
          onAOIChange={setAOI} 
          onParcelSelect={setSelectedAddressParcel}
        />
      </div>
    </div>
  );
}