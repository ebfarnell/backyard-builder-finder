import type { Geometry } from './types.js';

/**
 * Calculate the area of a polygon in square feet
 */
export function calculatePolygonArea(geometry: Geometry): number {
  if (geometry.type !== 'Polygon') {
    throw new Error('Only Polygon geometry supported');
  }

  const coords = geometry.coordinates[0] as [number, number][];
  let area = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    area += x1 * y2 - x2 * y1;
  }

  // Convert from degrees to square feet (approximate)
  // This is a rough conversion - in production you'd use proper projection
  const sqDegrees = Math.abs(area) / 2;
  const sqFeet = sqDegrees * 364000 * 364000; // Rough conversion at LA latitude
  
  return sqFeet;
}

/**
 * Calculate the centroid of a polygon
 */
export function calculateCentroid(geometry: Geometry): [number, number] {
  if (geometry.type !== 'Polygon') {
    throw new Error('Only Polygon geometry supported');
  }

  const coords = geometry.coordinates[0] as [number, number][];
  let x = 0;
  let y = 0;

  for (const [lng, lat] of coords) {
    x += lng;
    y += lat;
  }

  return [x / coords.length, y / coords.length];
}

/**
 * Calculate bearing between two points in degrees
 */
export function calculateBearing(
  point1: [number, number],
  point2: [number, number]
): number {
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;

  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Create a buffer around a geometry (simplified version)
 */
export function bufferGeometry(geometry: Geometry, bufferDistance: number): Geometry {
  if (geometry.type !== 'Polygon') {
    throw new Error('Only Polygon geometry supported');
  }

  const coords = geometry.coordinates[0] as [number, number][];
  const bufferedCoords: [number, number][] = [];

  // Simple buffer by expanding each point outward
  // In production, use a proper geometry library like Turf.js
  for (const [lng, lat] of coords) {
    bufferedCoords.push([
      lng + bufferDistance * 0.00001, // Rough degree conversion
      lat + bufferDistance * 0.00001
    ]);
  }

  return {
    type: 'Polygon',
    coordinates: [bufferedCoords]
  };
}

/**
 * Check if two geometries intersect (simplified)
 */
export function geometriesIntersect(geom1: Geometry, geom2: Geometry): boolean {
  // Simplified intersection check using bounding boxes
  const bbox1 = getBoundingBox(geom1);
  const bbox2 = getBoundingBox(geom2);

  return !(
    bbox1.maxLng < bbox2.minLng ||
    bbox2.maxLng < bbox1.minLng ||
    bbox1.maxLat < bbox2.minLat ||
    bbox2.maxLat < bbox1.minLat
  );
}

/**
 * Get bounding box of a geometry
 */
export function getBoundingBox(geometry: Geometry) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const processCoords = (coords: any[]) => {
    for (const coord of coords) {
      if (Array.isArray(coord[0])) {
        processCoords(coord);
      } else {
        const [lng, lat] = coord;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  };

  processCoords(geometry.coordinates);

  return { minLng, maxLng, minLat, maxLat };
}

/**
 * Calculate IoU (Intersection over Union) between two polygons
 */
export function calculateIoU(geom1: Geometry, geom2: Geometry): number {
  // Simplified IoU calculation
  // In production, use a proper geometry library
  if (!geometriesIntersect(geom1, geom2)) {
    return 0;
  }

  const area1 = calculatePolygonArea(geom1);
  const area2 = calculatePolygonArea(geom2);
  
  // Rough intersection area estimate
  const bbox1 = getBoundingBox(geom1);
  const bbox2 = getBoundingBox(geom2);
  
  const intersectionArea = Math.max(0,
    Math.min(bbox1.maxLng, bbox2.maxLng) - Math.max(bbox1.minLng, bbox2.minLng)
  ) * Math.max(0,
    Math.min(bbox1.maxLat, bbox2.maxLat) - Math.max(bbox1.minLat, bbox2.minLat)
  ) * 364000 * 364000;

  const unionArea = area1 + area2 - intersectionArea;
  
  return unionArea > 0 ? intersectionArea / unionArea : 0;
}