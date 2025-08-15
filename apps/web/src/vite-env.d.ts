/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_URL: string
  readonly VITE_APP_URL: string
  readonly VITE_SENTRY_DSN_WEB: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}