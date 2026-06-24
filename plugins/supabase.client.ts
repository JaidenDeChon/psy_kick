import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lazy Supabase provider.
 *
 * The plugin body is intentionally trivial and synchronous: it imports NOTHING
 * from '@supabase/supabase-js' at module scope, so the library is code-split out
 * of the entry bundle and never blocks first-paint / hydration on light pages
 * like the homepage.
 *
 * The actual client (and its ~150KB of auth/realtime/postgrest/storage code) is
 * dynamically imported and created the FIRST time `$getSupabase()` is called —
 * i.e. when a page actually hits the API. Anonymous sign-in + profile ensure run
 * as part of that one-time init. The result is memoized.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const handle = useState<string>('userHandle', () => '')

  let clientPromise: Promise<SupabaseClient> | null = null

  async function init(): Promise<SupabaseClient> {
    const url = config.public.supabaseUrl
    const key = config.public.supabaseAnonKey
    if (!url || !key) {
      throw new Error('[psy_kick] Supabase env vars not set — check your .env file')
    }

    // Dynamic import → separate async chunk, never in the entry bundle.
    const { createClient } = await import('@supabase/supabase-js')

    const supabase = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'psy_kick_auth' },
    })

    // Ensure a profile row exists after sign-in (idempotent), and surface the handle.
    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        try {
          const data = await ($fetch as any)('/api/profile/ensure', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          if (data?.handle) handle.value = (data as { handle: string }).handle
        } catch { /* non-fatal */ }
      }
    })

    // Ensure an identity exists (anonymous on first use).
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) console.error('[psy_kick] Anonymous sign-in failed:', error.message)
    }

    return supabase
  }

  /** Memoized accessor: creates the client on first call, returns the same promise after. */
  function getSupabase(): Promise<SupabaseClient> {
    if (!clientPromise) clientPromise = init()
    return clientPromise
  }

  nuxtApp.provide('getSupabase', getSupabase)
})
