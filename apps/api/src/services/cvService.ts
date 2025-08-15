import { config } from '../config.js';

interface CVDetectionResult {
  pools: Array<{
    geometry: any;
    confidence: number;
  }>;
  processingTime: number;
}

export class CVService {
  async detectPools(parcel: any): Promise<CVDetectionResult> {
    try {
      const response = await fetch(`${config.CV_SERVICE_URL}/cv/pool-detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelId: parcel.id,
          geometry: parcel.geometry,
        }),
      });

      if (!response.ok) {
        throw new Error(`CV service error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('CV service error:', error);
      // Return empty result on error
      return {
        pools: [],
        processingTime: 0,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${config.CV_SERVICE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const cvService = new CVService();