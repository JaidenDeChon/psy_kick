import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the Supabase client, creating it lazily on first use.
 * Async because the library is dynamically imported (code-split out of the entry
 * bundle) and anonymous sign-in runs as part of the one-time init.
 */
export function useSupabase(): Promise<SupabaseClient> {
  const { $getSupabase } = useNuxtApp()
  if (!$getSupabase) return Promise.reject(new Error('[psy_kick] Supabase plugin not available'))
  return ($getSupabase as () => Promise<SupabaseClient>)()
}

/** Returns the current user's JWT for API calls (initializes the client if needed). */
export async function useAuthToken(): Promise<string | undefined> {
  const supabase = await useSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}
