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

/**
 * The single gate for all social participation (judging, following, public
 * listing): a real cloud account (not anonymous) whose email is confirmed. OAuth
 * (Google) returns a verified email and clears on first sign-in; email/password
 * waits for the confirmation link. Mirrors the SQL `public.is_cloud_verified`.
 */
export function isCloudVerified(user: User): boolean {
  if (user.is_anonymous) return false
  return !!user.email_confirmed_at || !!user.confirmed_at
}

/** Throw 403 unless the user is a cloud + verified account. */
export function requireCloudVerified(user: User): void {
  if (!isCloudVerified(user)) {
    throw createError({
      statusCode: 403,
      message: 'A confirmed account is required for this. Sign in and verify your email.',
    })
  }
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
