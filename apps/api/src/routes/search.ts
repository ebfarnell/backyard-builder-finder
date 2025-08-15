import { FastifyPluginAsync } from 'fastify';
import { SearchRequestSchema, SearchProgressSchema } from '@shared/types';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { searchService } from '../services/searchService.js';

interface SearchState {
  [searchId: string]: {
    clients: Set<any>;
    progress: any;
  };
}

const searchStates: SearchState = {};

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Start a new search
  fastify.post('/search', async (request, reply) => {
    const searchRequest = SearchRequestSchema.parse(request.body);
    const searchId = generateSearchId();

    // Initialize search state
    searchStates[searchId] = {
      clients: new Set(),
      progress: {
        stage: 'starting',
        processed: 0,
        total: 0,
        message: 'Initializing search...',
      },
    };

    // Start the search process asynchronously
    searchService.executeSearch(searchId, searchRequest, (progress) => {
      searchStates[searchId].progress = progress;
      broadcastProgress(searchId, progress);
    }).catch((error) => {
      const errorProgress = {
        stage: 'error',
        processed: 0,
        total: 0,
        message: 'Search failed',
        error: error.message,
      };
      searchStates[searchId].progress = errorProgress;
      broadcastProgress(searchId, errorProgress);
    });

    return { searchId };
  });

  // Server-sent events for search progress
  fastify.get('/search/:searchId/progress', async (request, reply) => {
    const { searchId } = request.params as { searchId: string };

    if (!searchStates[searchId]) {
      reply.status(404);
      return { error: 'Search not found' };
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Add client to the set
    const clientId = Math.random().toString(36);
    searchStates[searchId].clients.add(reply.raw);

    // Send current progress immediately
    const currentProgress = searchStates[searchId].progress;
    reply.raw.write(`data: ${JSON.stringify(currentProgress)}\n\n`);

    // Handle client disconnect
    request.raw.on('close', () => {
      searchStates[searchId]?.clients.delete(reply.raw);
      
      // Clean up if no more clients
      if (searchStates[searchId]?.clients.size === 0) {
        setTimeout(() => {
          if (searchStates[searchId]?.clients.size === 0) {
            delete searchStates[searchId];
          }
        }, 60000); // Clean up after 1 minute
      }
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      if (reply.raw.destroyed) {
        clearInterval(keepAlive);
        return;
      }
      reply.raw.write(': keepalive\n\n');
    }, 30000);

    request.raw.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  // Export search results
  fastify.get('/search/:searchId/export', async (request, reply) => {
    const { searchId } = request.params as { searchId: string };
    const { format } = request.query as { format: 'csv' | 'geojson' };

    if (!searchStates[searchId]) {
      reply.status(404);
      return { error: 'Search not found' };
    }

    const progress = searchStates[searchId].progress;
    if (!progress.results || progress.results.length === 0) {
      reply.status(404);
      return { error: 'No results to export' };
    }

    if (format === 'csv') {
      const csv = generateCSV(progress.results);
      reply.type('text/csv');
      reply.header('Content-Disposition', 'attachment; filename="yard-qualifier-results.csv"');
      return csv;
    } else if (format === 'geojson') {
      const geojson = generateGeoJSON(progress.results);
      reply.type('application/geo+json');
      reply.header('Content-Disposition', 'attachment; filename="yard-qualifier-results.geojson"');
      return geojson;
    } else {
      reply.status(400);
      return { error: 'Invalid format. Use csv or geojson' };
    }
  });
};

function generateSearchId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function broadcastProgress(searchId: string, progress: any) {
  const state = searchStates[searchId];
  if (!state) return;

  const message = `data: ${JSON.stringify(progress)}\n\n`;
  
  for (const client of state.clients) {
    if (!client.destroyed) {
      try {
        client.write(message);
      } catch (error) {
        // Remove broken clients
        state.clients.delete(client);
      }
    }
  }
}

function generateCSV(results: any[]): string {
  if (results.length === 0) return '';

  const headers = [
    'APN',
    'Address',
    'Lot Area (sq ft)',
    'Zoning Code',
    'Rear Free Area (sq ft)',
    'Has Pool',
    'Qualifies',
    'Rationale',
    'Last Sale Price',
    'Last Sale Date',
    'HOA Status',
  ];

  const rows = results.map(parcel => [
    parcel.apn,
    parcel.address || '',
    parcel.lotArea,
    parcel.zoningCode || '',
    parcel.rearFreeSqft || '',
    parcel.hasPool ? 'Yes' : 'No',
    parcel.qualifies === null ? 'Unknown' : (parcel.qualifies ? 'Yes' : 'No'),
    parcel.rationale || '',
    parcel.lastSalePrice || '',
    parcel.lastSaleDate || '',
    parcel.hoaStatus,
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function generateGeoJSON(results: any[]): any {
  return {
    type: 'FeatureCollection',
    features: results.map(parcel => ({
      type: 'Feature',
      geometry: parcel.geometry,
      properties: {
        apn: parcel.apn,
        address: parcel.address,
        lotArea: parcel.lotArea,
        zoningCode: parcel.zoningCode,
        rearFreeSqft: parcel.rearFreeSqft,
        hasPool: parcel.hasPool,
        qualifies: parcel.qualifies,
        rationale: parcel.rationale,
        lastSalePrice: parcel.lastSalePrice,
        lastSaleDate: parcel.lastSaleDate,
        hoaStatus: parcel.hoaStatus,
      },
    })),
  };
}