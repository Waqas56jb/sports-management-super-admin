/**
 * Centralised Supabase client (server-side only). It uses the service-role key, so it must never
 * be sent to a browser. Database access goes through the PostgreSQL pool (config/database.js),
 * which gives real transactions; this client is used for Supabase Storage.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

let client = null;

export const isStorageConfigured = () => Boolean(env.supabase.url && env.supabase.serviceRoleKey);

export function getSupabase() {
  if (!isStorageConfigured()) return null;
  if (!client) {
    client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'sports-management-api' } },
    });
  }
  return client;
}
