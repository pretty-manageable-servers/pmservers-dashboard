import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: Promise<SupabaseClient> | null = null;

/** Browser client. Not used in auth mock mode. Loaded on first use, to keep the first page load small. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    );
  }
  return client;
}

export interface StoredSession {
  access_token: string;
  expires_at?: number;
  user: { id: string; email?: string; app_metadata: { provider?: string } };
}

/**
 * The session that supabase-js saved in localStorage, read without loading supabase-js.
 * Returns null if there is none or it has expired.
 */
export function readStoredSession(): StoredSession | null {
  try {
    const ref = new URL(env.supabaseUrl).hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s.access_token || !s.user) return null;
    if (s.expires_at && s.expires_at * 1000 < Date.now() + 30_000) return null;
    return s;
  } catch {
    return null;
  }
}
