import { describe, it, expect } from 'vitest';
import { 
  calculatePolygonArea, 
  calculateCentroid, 
  calculateBearing,
  calculateIoU 
} from '@shared/geometry';

describe('Geometry utilities', () => {
  const testPolygon = {
    type: 'Polygon' as const,
    coordinates: [[
      [-118.4001, 34.0701],
      [-118.3999, 34.0701],
      [-118.3999, 34.0699],
      [-118.4001, 34.0699],
      [-118.4001, 34.0701]
    ]]
  };

  describe('calculatePolygonArea', () => {
    it('should calculate area for a valid polygon', () => {
      const area = calculatePolygonArea(testPolygon);
      expect(area).toBeGreaterThan(0);
      expect(typeof area).toBe('number');
    });

    it('should throw error for non-polygon geometry', () => {
      const point = { type: 'Point' as const, coordinates: [0, 0] };
      expect(() => calculatePolygonArea(point as any)).toThrow();
    });
  });

  describe('calculateCentroid', () => {
    it('should calculate centroid for a polygon', () => {
      const centroid = calculateCentroid(testPolygon);
      expect(centroid).toHaveLength(2);
      expect(centroid[0]).toBeCloseTo(-118.4, 3);
      expect(centroid[1]).toBeCloseTo(34.07, 3);
    });
  });

  describe('calculateBearing', () => {
    it('should calculate bearing between two points', () => {
      const point1: [number, number] = [-118.4, 34.07];
      const point2: [number, number] = [-118.39, 34.07];
      
      const bearing = calculateBearing(point1, point2);
      expect(bearing).toBeCloseTo(90, 1); // Eastward
    });

    it('should return value between 0 and 360', () => {
      const point1: [number, number] = [0, 0];
      const point2: [number, number] = [-1, -1];
      
      const bearing = calculateBearing(point1, point2);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });

  describe('calculateIoU', () => {
    it('should return 1 for identical polygons', () => {
      const iou = calculateIoU(testPolygon, testPolygon);
      expect(iou).toBeCloseTo(1, 2);
    });

    it('should return 0 for non-overlapping polygons', () => {
      const polygon2 = {
        type: 'Polygon' as const,
        coordinates: [[
          [-118.3, 34.0],
          [-118.29, 34.0],
          [-118.29, 33.99],
          [-118.3, 33.99],
          [-118.3, 34.0]
        ]]
      };
      
      const iou = calculateIoU(testPolygon, polygon2);
      expect(iou).toBe(0);
    });

    it('should return value between 0 and 1 for overlapping polygons', () => {
      const overlappingPolygon = {
        type: 'Polygon' as const,
        coordinates: [[
          [-118.4, 34.07],
          [-118.3998, 34.07],
          [-118.3998, 34.0698],
          [-118.4, 34.0698],
          [-118.4, 34.07]
        ]]
      };
      
      const iou = calculateIoU(testPolygon, overlappingPolygon);
      expect(iou).toBeGreaterThan(0);
      expect(iou).toBeLessThan(1);
    });
  });
});