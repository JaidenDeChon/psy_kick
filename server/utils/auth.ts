import type { H3Event } from 'h3'
import type { User } from '@supabase/supabase-js'
import { useUserClient } from './supabase'

/**
 * Whether the account can sign in with a password (an `email` provider/identity
 * exists). OAuth-only accounts (e.g. Google) return false — they have no current
 * password to confirm, so password-gated actions fall back to session proof.
 */
export function accountHasPassword(user: User): boolean {
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? []
  if (providers.includes('email')) return true
  return (user.identities ?? []).some(i => i.provider === 'email')
}

export async function getServerUser(event: H3Event) {
  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing authorization token' })
  }

  const client = useUserClient(token)
  const { data: { user }, error } = await client.auth.getUser()

  if (error || !user) {
    throw createError({ statusCode: 401, message: 'Invalid or expired token' })
  }

  return { user, token }
}
