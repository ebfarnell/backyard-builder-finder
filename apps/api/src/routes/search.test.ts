import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { searchRoutes } from './search.js';

// Mock the search service
vi.mock('../services/searchService.js', () => ({
  searchService: {
    executeSearch: vi.fn(),
  },
}));

describe('Search Routes', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(searchRoutes, { prefix: '/api' });
  });

  describe('POST /search', () => {
    it('should start a new search with valid request', async () => {
      const searchRequest = {
        aoi: {
          type: 'Polygon',
          coordinates: [[
            [-118.51, 34.01],
            [-118.37, 34.01],
            [-118.37, 34.13],
            [-118.51, 34.13],
            [-118.51, 34.01]
          ]]
        },
        filters: {
          minRearSqft: 500,
          lotSizeMin: 5000,
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: searchRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('searchId');
      expect(typeof body.searchId).toBe('string');
    });

    it('should reject invalid search request', async () => {
      const invalidRequest = {
        aoi: {
          type: 'Point', // Invalid - should be Polygon
          coordinates: [0, 0]
        },
        filters: {}
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject request without AOI', async () => {
      const invalidRequest = {
        filters: {
          minRearSqft: 500,
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /search/:searchId/progress', () => {
    it('should return 404 for non-existent search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/search/non-existent/progress',
      });

      expect(response.statusCode).toBe(404);
    });

    // Note: Testing SSE endpoints is complex and would require more setup
    // In a real test, you'd mock the search state and test the SSE stream
  });

  describe('GET /search/:searchId/export', () => {
    it('should return 404 for non-existent search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/search/non-existent/export?format=csv',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject invalid export format', async () => {
      // First create a search (this would be mocked in real tests)
      const searchResponse = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          aoi: {
            type: 'Polygon',
            coordinates: [[[-118.51, 34.01], [-118.37, 34.01], [-118.37, 34.13], [-118.51, 34.13], [-118.51, 34.01]]]
          },
          filters: { minRearSqft: 500 }
        },
      });

      const { searchId } = JSON.parse(searchResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/search/${searchId}/export?format=invalid`,
      });

      expect(response.statusCode).toBe(400);
    });
  });
});