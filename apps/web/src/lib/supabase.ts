import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

export type Database = {
  public: {
    Tables: {
      parcels: {
        Row: {
          id: string;
          apn: string;
          address: string | null;
          geometry: any;
          lot_area: number;
          zoning_code: string | null;
          last_sale_price: number | null;
          last_sale_date: string | null;
          rear_free_sqft: number | null;
          has_pool: boolean | null;
          qualifies: boolean | null;
          rationale: string | null;
          hoa_status: 'unknown' | 'yes' | 'no';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['parcels']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['parcels']['Insert']>;
      };
      building_footprints: {
        Row: {
          id: string;
          parcel_id: string;
          geometry: any;
          is_primary: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['building_footprints']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['building_footprints']['Insert']>;
      };
      cv_detections: {
        Row: {
          id: string;
          parcel_id: string;
          kind: 'pool' | 'building';
          geometry: any;
          confidence: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cv_detections']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['cv_detections']['Insert']>;
      };
      api_usage: {
        Row: {
          id: string;
          user_id: string;
          search_id: string;
          provider: string;
          model: string;
          tokens_used: number;
          cost: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['api_usage']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['api_usage']['Insert']>;
      };
      user_api_keys: {
        Row: {
          id: string;
          user_id: string;
          provider: 'openai' | 'anthropic';
          key_hash: string;
          is_encrypted: boolean;
          created_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['user_api_keys']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_api_keys']['Insert']>;
      };
    };
  };
};