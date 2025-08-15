import { z } from 'zod';
import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // Frontend URL
  VITE_APP_URL: z.string().url().default('http://localhost:5173'),
  
  // External services
  CV_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  REGRID_API_KEY: z.string(),
  NAIP_TEMPLATE_URL: z.string().url(),
  
  // LLM providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_ANTHROPIC_ENABLED: z.coerce.boolean().default(false),
  
  // Observability
  SENTRY_DSN_API: z.string().optional(),
  
  // Rate limiting & caps
  MAX_PARCELS_PER_SEARCH: z.coerce.number().default(10000),
  LLM_BUDGET_PER_SEARCH: z.coerce.number().default(1.0),
  SEARCH_RATE_LIMIT_PER_HOUR: z.coerce.number().default(10),
});

export const config = configSchema.parse(process.env);