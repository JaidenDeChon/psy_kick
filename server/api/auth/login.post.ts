import { createClient } from '@supabase/supabase-js'
import { useServiceRoleClient } from '../../utils/supabase'

/**
 * Username-or-email sign-in. The identity field accepts either; emails are never
 * exposed to the client, so username→email resolution happens here (service role,
 * via the email_by_identity SECURITY DEFINER fn). Returns session tokens on
 * success; a single generic 401 on any failure (no username/email enumeration).
 */
export default defineEventHandler(async (event) => {
  const { identity, password } = await readBody(event)
  if (typeof identity !== 'string' || typeof password !== 'string' || !identity || !password) {
    throw createError({ statusCode: 400, message: 'identity and password are required' })
  }

  const config = useRuntimeConfig()
  const invalid = () => createError({ statusCode: 401, message: 'Invalid username/email or password' })

  // Resolve to the account email.
  let email: string | null = null
  if (identity.includes('@')) {
    email = identity
  }
  else {
    const db = useServiceRoleClient()
    const { data } = await db.rpc('email_by_identity', { ident: identity })
    email = (data as string | null) ?? null
  }
  if (!email) throw invalid()

  // Sign in server-side with a throwaway anon-key client; hand the session to the client.
  const anon = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw invalid()

  return {
    tokens: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  }
})
