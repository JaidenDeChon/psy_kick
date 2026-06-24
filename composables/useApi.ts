import type { SupabaseClient } from '@supabase/supabase-js'

export function useApi() {
  // Capture nuxtApp at setup time (Vue context); the client is created lazily.
  const nuxtApp = useNuxtApp()

  async function apiFetch<T = unknown>(url: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    const getSupabase = nuxtApp.$getSupabase as (() => Promise<SupabaseClient>) | undefined

    // First call here triggers lazy client creation + anonymous sign-in.
    let token: string | undefined
    if (getSupabase) {
      try {
        const supabase = await getSupabase()
        token = (await supabase.auth.getSession()).data.session?.access_token
      } catch (err) {
        console.error('[psy_kick] Supabase init failed:', err)
      }
    }

    return ($fetch as any)(url, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }) as Promise<T>
  }

  return { apiFetch }
}
