/**
 * App configuration. Fill in your Supabase project values below.
 *
 * Get these from: Supabase Dashboard -> Project Settings -> API
 *   - Project URL        -> SUPABASE_URL
 *   - Project API keys -> anon / public -> SUPABASE_ANON_KEY
 *
 * The anon key is safe to ship in a client app; row-level security (RLS)
 * on the database is what actually protects data. See supabase/schema.sql.
 */
export const SUPABASE_URL = 'https://lbnfshhjjgoydfylaqiw.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxibmZzaGhqamdveWRmeWxhcWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTYzMzcsImV4cCI6MjEwMTY5MjMzN30.7G9EYoR_lkWQu-7dIq5tLg_ystlC-qR1jsYF9CmhEck';

/**
 * Google OAuth: the web client ID from your Google Cloud console, used by
 * Supabase for Google sign-in. Also configure this URL in Supabase Auth
 * providers. Leave empty to hide the Google button until configured.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '692939480060-3kv0uumc3etthal03jrmg50n6a59scbu.apps.googleusercontent.com';

/** The on-device model filename (bundled + reassembled on first launch). */
export const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';

/** Deep-link scheme (must match app.json "scheme"). */
export const APP_SCHEME = 'fitpilot';
