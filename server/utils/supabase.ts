import { createClient } from '@supabase/supabase-js'

/** Service-role client — bypasses RLS. Use only in server routes, never leak to client. */
export function useServiceRoleClient() {
  const config = useRuntimeConfig()
  return createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey,
    { auth: { persistSession: false } }
  )
}

/** Client scoped to a user's JWT — RLS enforced. */
export function useUserClient(token: string) {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}
