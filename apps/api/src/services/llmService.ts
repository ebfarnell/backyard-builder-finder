import type { SearchFilters } from '@shared/types';
import { config } from '../config.js';

interface LLMAnalysisResult {
  qualifies: boolean;
  rationale: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
}

export class LLMService {
  async analyzeParcel(parcel: any, filters: SearchFilters): Promise<LLMAnalysisResult> {
    // Use Supabase Edge Function for LLM analysis
    const response = await fetch(`${config.SUPABASE_URL}/functions/v1/llm_summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        parcel: {
          apn: parcel.apn,
          address: parcel.address,
          lotArea: parcel.lot_area,
          rearFreeSqft: parcel.rear_free_sqft,
          hasPool: parcel.has_pool,
          zoningCode: parcel.zoning_code,
          approximate: parcel.rear_yard_approximate,
        },
        filters: {
          minRearSqft: filters.minRearSqft,
          hasPool: filters.hasPool,
        },
        prompt: this.buildPrompt(parcel, filters),
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM service error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  private buildPrompt(parcel: any, filters: SearchFilters): string {
    return `Analyze this parcel for rear yard qualification:

Parcel Details:
- APN: ${parcel.apn}
- Address: ${parcel.address || 'Unknown'}
- Lot Size: ${parcel.lot_area} sq ft
- Rear Yard Free Area: ${parcel.rear_free_sqft} sq ft ${parcel.rear_yard_approximate ? '(approximate)' : '(calculated)'}
- Has Pool: ${parcel.has_pool ? 'Yes' : 'No'}
- Zoning: ${parcel.zoning_code || 'Unknown'}

Requirements:
- Minimum rear yard: ${filters.minRearSqft} sq ft
- Pool requirement: ${filters.hasPool === undefined ? 'Any' : filters.hasPool ? 'Required' : 'Not allowed'}

Question: Does this parcel qualify for the rear yard requirements? Consider:
1. The calculated rear yard area vs minimum requirement
2. Whether the calculation is approximate (less reliable)
3. Pool requirements if specified
4. Any zoning considerations

Respond with:
- "qualifies": true/false
- "rationale": Brief one-sentence explanation

Be conservative with approximate calculations.`;
  }
}

export const llmService = new LLMService();