import { createClient } from '@supabase/supabase-js'

/**
 * Confirm a user's current password by attempting a throwaway server-side
 * sign-in (no session persisted). Returns true only on a successful match.
 * Mirrors the resolution in server/api/auth/login.post.ts.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const config = useRuntimeConfig()
  const anon = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  return !error && !!data.session
}
