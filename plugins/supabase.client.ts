import type { SupabaseClient } from '@supabase/supabase-js'
import { toAuthUser, type AuthUser } from '~/composables/useAuth'

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
  const authUser = useState<AuthUser | null>('authUser', () => null)

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

    // Keep the global auth state (footer + access_terminal dialog) in sync with
    // every transition — sign-in, sign-out, OAuth redirect return, token refresh,
    // and the USER_UPDATED that lands when an email upgrade is confirmed.
    supabase.auth.onAuthStateChange(async (event, session) => {
      authUser.value = toAuthUser(session?.user)
      if (!session) {
        handle.value = ''
        try { localStorage.removeItem('psy_kick_handle') } catch { /* ignore */ }
      }

      // Ensure a profile row exists after sign-in (idempotent), and surface the handle.
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') && session) {
        try {
          const data = await ($fetch as any)('/api/profile/ensure', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          if (data?.handle) {
            handle.value = (data as { handle: string }).handle
            // Cache it so hydrateFromStorage() can restore it on the next cold
            // load without booting Supabase. Only persist for real accounts —
            // anonymous handles are throwaway and never shown.
            try {
              if (session.user.is_anonymous) localStorage.removeItem('psy_kick_handle')
              else localStorage.setItem('psy_kick_handle', handle.value)
            } catch { /* ignore */ }
          }
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
