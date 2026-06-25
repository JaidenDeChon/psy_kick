import { createClient } from '@supabase/supabase-js'
import { useServiceRoleClient } from '../../utils/supabase'

/**
 * Send a password-reset link for a username OR email. Resolves username→email
 * server-side (private). Always returns ok — never reveals whether the account
 * exists (no enumeration).
 */
export default defineEventHandler(async (event) => {
  const { identity, redirectTo } = await readBody(event)
  if (typeof identity !== 'string' || !identity) {
    throw createError({ statusCode: 400, message: 'identity is required' })
  }

  const config = useRuntimeConfig()

  let email: string | null = null
  if (identity.includes('@')) {
    email = identity
  }
  else {
    const db = useServiceRoleClient()
    const { data } = await db.rpc('email_by_identity', { ident: identity })
    email = (data as string | null) ?? null
  }

  if (email) {
    const anon = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await anon.auth.resetPasswordForEmail(email, {
      redirectTo: typeof redirectTo === 'string' ? redirectTo : undefined,
    })
  }

  return { ok: true }
})
