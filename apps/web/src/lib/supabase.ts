/**
 * Supabase client configuration for Backyard Builder Finder
 */

import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client-side Supabase client
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
}

// Client component client (for use in React components)
export const createSupabaseComponentClient = () => {
  return createClientComponentClient()
}

// Server component client (for use in Server Components)
export const createSupabaseServerClient = () => {
  return createServerComponentClient({ cookies })
}

// Database types (will be generated from Supabase)
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          plan_tier: 'free' | 'pro' | 'enterprise'
          limits_jsonb: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          plan_tier?: 'free' | 'pro' | 'enterprise'
          limits_jsonb?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          plan_tier?: 'free' | 'pro' | 'enterprise'
          limits_jsonb?: any
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          auth_user_id: string
          org_id: string
          email: string
          name: string
          sso_provider: 'google' | 'microsoft' | 'email'
          sso_subject: string | null
          role: 'admin' | 'user' | 'viewer'
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          org_id: string
          email: string
          name: string
          sso_provider?: 'google' | 'microsoft' | 'email'
          sso_subject?: string | null
          role?: 'admin' | 'user' | 'viewer'
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          org_id?: string
          email?: string
          name?: string
          sso_provider?: 'google' | 'microsoft' | 'email'
          sso_subject?: string | null
          role?: 'admin' | 'user' | 'viewer'
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      searches: {
        Row: {
          id: string
          org_id: string
          user_id: string
          name: string
          area_geom: any
          area_name: string | null
          filters_jsonb: any
          options_jsonb: any
          status: 'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          total_candidates: number | null
          filtered_count: number | null
          results_count: number | null
          execution_time_ms: number | null
          stage_timings_jsonb: any | null
          costs_jsonb: any | null
          error_message: string | null
          error_details_jsonb: any | null
          cache_key: string | null
          results_cached_until: string | null
          created_at: string
          updated_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          name: string
          area_geom: any
          area_name?: string | null
          filters_jsonb?: any
          options_jsonb?: any
          status?: 'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          total_candidates?: number | null
          filtered_count?: number | null
          results_count?: number | null
          execution_time_ms?: number | null
          stage_timings_jsonb?: any | null
          costs_jsonb?: any | null
          error_message?: string | null
          error_details_jsonb?: any | null
          cache_key?: string | null
          results_cached_until?: string | null
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          name?: string
          area_geom?: any
          area_name?: string | null
          filters_jsonb?: any
          options_jsonb?: any
          status?: 'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          total_candidates?: number | null
          filtered_count?: number | null
          results_count?: number | null
          execution_time_ms?: number | null
          stage_timings_jsonb?: any | null
          costs_jsonb?: any | null
          error_message?: string | null
          error_details_jsonb?: any | null
          cache_key?: string | null
          results_cached_until?: string | null
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      plan_tier: 'free' | 'pro' | 'enterprise'
      user_role: 'admin' | 'user' | 'viewer'
      sso_provider: 'google' | 'microsoft' | 'email'
      search_status: 'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
    }
  }
}