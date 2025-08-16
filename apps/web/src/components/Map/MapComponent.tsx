import React, { useRef, useEffect, useState, useCallback } from 'react';
import Map, { MapRef, Source, Layer, Marker } from 'react-map-gl/maplibre';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { Geometry, FeatureCollection } from '@shared/types';
import { useSearch } from '@/contexts/SearchContext';
import { api } from '@/lib/api';
import DrawingToolbar from './DrawingToolbar';
import AddressSearch from './AddressSearch';

// MapboxDraw types
interface DrawEvent {
  type: string;
  target: MapboxDraw;
  features: GeoJSON.Feature[];
}

interface MapboxDrawInstance extends MapboxDraw {
  onAdd(map: any): HTMLElement;
  onRemove(map: any): void;
}

interface AddressMarker {
  address: string;
  lat: number;
  lon: number;
  display_name: string;
}

const INITIAL_VIEW_STATE = {
  longitude: -118.2437,
  latitude: 34.0522,
  zoom: 10,
};

interface MapComponentProps {
  onAOIChange?: (geometry: Geometry | null) => void;
  onParcelSelect?: (parcel: FeatureCollection | null) => void;
}

export default function MapComponent({ onAOIChange, onParcelSelect }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDrawInstance | null>(null);
  const { results, aoi } = useSearch();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle' | 'circle' | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<AddressMarker | null>(null);

  // Enhanced MapboxDraw configuration
  const drawConfig = {
    displayControlsDefault: false,
    controls: {
      polygon: true,
      rectangle: true,
      circle: true,
      trash: true,
    },
    styles: [
      // Polygon fill
      {
        id: 'gl-draw-polygon-fill-inactive',
        type: 'fill',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        paint: {
          'fill-color': '#3b82f6',
          'fill-outline-color': '#3b82f6',
          'fill-opacity': 0.2,
        },
      },
      {
        id: 'gl-draw-polygon-fill-active',
        type: 'fill',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
        paint: {
          'fill-color': '#1d4ed8',
          'fill-outline-color': '#1d4ed8',
          'fill-opacity': 0.3,
        },
      },
      // Polygon outline
      {
        id: 'gl-draw-polygon-stroke-inactive',
        type: 'line',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
        },
      },
      {
        id: 'gl-draw-polygon-stroke-active',
        type: 'line',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 3,
        },
      },
      // Points (vertices)
      {
        id: 'gl-draw-point-point-stroke-inactive',
        type: 'circle',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'static']],
        paint: {
          'circle-radius': 5,
          'circle-opacity': 1,
          'circle-color': '#fff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#3b82f6',
        },
      },
      {
        id: 'gl-draw-point-point-stroke-active',
        type: 'circle',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
        paint: {
          'circle-radius': 6,
          'circle-opacity': 1,
          'circle-color': '#fff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#1d4ed8',
        },
      },
    ],
  };

  // Convert results to GeoJSON for display
  const resultsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: results.map(parcel => ({
      type: 'Feature' as const,
      id: parcel.id,
      geometry: parcel.geometry,
      properties: {
        apn: parcel.apn,
        address: parcel.address,
        qualifies: parcel.qualifies,
        hasPool: parcel.hasPool,
        rearFreeSqft: parcel.rearFreeSqft,
      },
    })),
  };

  // Handle drawing events
  const handleDrawCreate = useCallback((e: DrawEvent) => {
    const feature = e.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      onAOIChange?.(feature.geometry as Geometry);
    }
  }, [onAOIChange]);

  const handleDrawUpdate = useCallback((e: DrawEvent) => {
    const feature = e.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      onAOIChange?.(feature.geometry as Geometry);
    }
  }, [onAOIChange]);

  const handleDrawDelete = useCallback(() => {
    onAOIChange?.(null);
  }, [onAOIChange]);

  // Initialize MapboxDraw when map loads
  useEffect(() => {
    if (mapLoaded && mapRef.current && !drawRef.current) {
      const map = mapRef.current.getMap();
      const draw = new MapboxDraw(drawConfig) as MapboxDrawInstance;
      
      map.addControl(draw, 'top-left');
      drawRef.current = draw;

      // Add event listeners
      map.on('draw.create', handleDrawCreate);
      map.on('draw.update', handleDrawUpdate);
      map.on('draw.delete', handleDrawDelete);
      map.on('draw.selectionchange', handleDrawUpdate);

      return () => {
        map.off('draw.create', handleDrawCreate);
        map.off('draw.update', handleDrawUpdate);
        map.off('draw.delete', handleDrawDelete);
        map.off('draw.selectionchange', handleDrawUpdate);
      };
    }
  }, [mapLoaded, handleDrawCreate, handleDrawUpdate, handleDrawDelete]);

  // Update draw layer when AOI changes externally (e.g., from file upload)
  useEffect(() => {
    if (drawRef.current && aoi) {
      drawRef.current.deleteAll();
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: aoi,
        properties: {},
      };
      drawRef.current.add(feature);
    } else if (drawRef.current && !aoi) {
      drawRef.current.deleteAll();
    }
  }, [aoi]);

  // Drawing mode functions
  const startDrawing = useCallback((mode: 'polygon' | 'rectangle' | 'circle') => {
    if (!drawRef.current) return;
    
    setDrawingMode(mode);
    drawRef.current.deleteAll();
    
    switch (mode) {
      case 'polygon':
        drawRef.current.changeMode('draw_polygon');
        break;
      case 'rectangle':
        // Rectangle mode: we'll use polygon mode and provide instructions for rectangular drawing
        drawRef.current.changeMode('draw_polygon');
        break;
      case 'circle':
        // For circle, we'll use a custom implementation or approximation
        drawRef.current.changeMode('draw_polygon');
        break;
    }
  }, []);

  const stopDrawing = useCallback(() => {
    if (drawRef.current) {
      drawRef.current.changeMode('simple_select');
      setDrawingMode(null);
    }
  }, []);

  const clearDrawing = useCallback(() => {
    if (drawRef.current) {
      drawRef.current.deleteAll();
      setDrawingMode(null);
      onAOIChange?.(null);
    }
  }, [onAOIChange]);

  // Export current AOI as GeoJSON
  const exportAOI = useCallback(() => {
    if (!aoi) return;
    
    const aoiGeoJSON = {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: { name: 'Area of Interest' },
        geometry: aoi,
      }]
    };
    
    const blob = new Blob([JSON.stringify(aoiGeoJSON, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aoi-${new Date().toISOString().split('T')[0]}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [aoi]);

  // Import GeoJSON for AOI
  const handleGeoJSONImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string);
        
        // Extract first polygon from the GeoJSON
        let geometry = null;
        if (geojson.type === 'Feature' && geojson.geometry.type === 'Polygon') {
          geometry = geojson.geometry;
        } else if (geojson.type === 'FeatureCollection' && geojson.features.length > 0) {
          const firstFeature = geojson.features.find((f: any) => f.geometry.type === 'Polygon');
          if (firstFeature) {
            geometry = firstFeature.geometry;
          }
        }

        if (geometry) {
          onAOIChange?.(geometry);
          console.log('GeoJSON imported successfully');
        } else {
          console.error('No valid polygon found in the uploaded file');
        }
      } catch (error) {
        console.error('Failed to parse GeoJSON file');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  }, [onAOIChange]);

  // Handle address selection from search
  const handleAddressSelect = useCallback(async (result: any) => {
    const addressMarker: AddressMarker = {
      address: result.address,
      lat: result.lat,
      lon: result.lon,
      display_name: result.display_name
    };
    
    setSelectedAddress(addressMarker);
    
    // Center map on selected address
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [result.lon, result.lat],
        zoom: 18,
        duration: 2000
      });
    }

    // Fetch parcel data for the selected address
    try {
      console.log('Fetching parcel data for coordinates:', result.lat, result.lon);
      const parcelData = await api.fetchParcelByCoordinates(result.lat, result.lon);
      console.log('Received parcel data:', parcelData);
      
      onParcelSelect?.(parcelData);
      
      if (parcelData.features && parcelData.features.length > 0) {
        console.log('Found parcel:', parcelData.features[0].properties);
      } else {
        console.log('No parcel found for this address');
      }
    } catch (error) {
      console.error('Failed to fetch parcel data:', error);
      onParcelSelect?.(null);
    }
  }, [onParcelSelect]);

  // Create AOI around selected address
  const handleCreateAOI = useCallback((result: any) => {
    const addressMarker: AddressMarker = {
      address: result.address,
      lat: result.lat,
      lon: result.lon,
      display_name: result.display_name
    };
    
    setSelectedAddress(addressMarker);
    
    // Create a rectangular AOI around the address (roughly 100m x 100m)
    const offset = 0.0009; // Approximately 100 meters in degrees
    const aoiGeometry: Geometry = {
      type: 'Polygon',
      coordinates: [[
        [result.lon - offset, result.lat - offset], // Southwest
        [result.lon + offset, result.lat - offset], // Southeast
        [result.lon + offset, result.lat + offset], // Northeast
        [result.lon - offset, result.lat + offset], // Northwest
        [result.lon - offset, result.lat - offset]  // Close polygon
      ]]
    };
    
    // Update AOI and center map
    onAOIChange?.(aoiGeometry);
    
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [result.lon, result.lat],
        zoom: 17,
        duration: 2000
      });
    }
  }, [onAOIChange]);

  return (
    <div className="h-full w-full relative">
      {/* Address Search */}
      <div className="absolute top-4 left-4 z-20">
        <AddressSearch
          onAddressSelect={handleAddressSelect}
          onCreateAOI={handleCreateAOI}
          placeholder="Type an address (e.g. '123 Main St, LA') or 'test'"
          className="w-80"
        />
      </div>

      {/* Enhanced Drawing Toolbar */}
      <DrawingToolbar
        drawingMode={drawingMode}
        onStartDrawing={startDrawing}
        onStopDrawing={stopDrawing}
        onClearDrawing={clearDrawing}
        onExportAOI={aoi ? exportAOI : undefined}
        onImportAOI={handleGeoJSONImport}
        hasDrawing={!!aoi}
      />

      {/* Enhanced Drawing Instructions */}
      {drawingMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                {drawingMode === 'polygon' && 'Click to add points • Double-click to finish'}
                {drawingMode === 'rectangle' && 'Click 4 points to create rectangle • Double-click to finish'}
                {drawingMode === 'circle' && 'Click to add points for circular area • Double-click to finish'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Map Area Stats */}
      {aoi && !drawingMode && (
        <div className="absolute bottom-4 left-4 z-10 bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg shadow-sm">
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="font-medium">Search area defined</span>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onLoad={() => setMapLoaded(true)}
      >
        {/* Parcel results layer */}
        {results.length > 0 && (
          <Source id="parcels" type="geojson" data={resultsGeoJSON}>
            <Layer
              id="parcels-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'case',
                  ['==', ['get', 'qualifies'], true],
                  '#10b981', // green for qualified
                  ['==', ['get', 'qualifies'], false],
                  '#ef4444', // red for not qualified
                  '#6b7280', // gray for unknown
                ],
                'fill-opacity': 0.6,
              }}
            />
            <Layer
              id="parcels-stroke"
              type="line"
              paint={{
                'line-color': '#374151',
                'line-width': 1,
              }}
            />
          </Source>
        )}

        {/* Vector tiles layer for all parcels */}
        <Source
          id="all-parcels"
          type="vector"
          tiles={[`${import.meta.env.VITE_API_URL || '/api'}/tiles/parcels/{z}/{x}/{y}.mvt`]}
        >
          <Layer
            id="all-parcels-fill"
            source-layer="parcels"
            type="fill"
            paint={{
              'fill-color': '#e5e7eb',
              'fill-opacity': 0.3,
            }}
          />
          <Layer
            id="all-parcels-stroke"
            source-layer="parcels"
            type="line"
            paint={{
              'line-color': '#9ca3af',
              'line-width': 0.5,
            }}
          />
        </Source>

        {/* Address Marker */}
        {selectedAddress && (
          <Marker
            longitude={selectedAddress.lon}
            latitude={selectedAddress.lat}
            anchor="bottom"
          >
            <div className="relative">
              {/* Marker pin */}
              <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              {/* Marker label */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow-lg border border-gray-200 whitespace-nowrap">
                <div className="text-xs font-medium text-gray-900">
                  {selectedAddress.address}
                </div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                </div>
              </div>
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}