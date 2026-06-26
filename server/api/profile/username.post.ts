import { getServerUser, accountHasPassword } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { USERNAME_RE } from '../../utils/handles'
import { verifyPassword } from '../../utils/verify-password'

/**
 * Change the current user's public username (profiles.handle). Password accounts
 * must confirm with their current password; OAuth-only accounts have none, so the
 * authenticated session itself is the proof. Case-insensitive uniqueness → 409.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  if (user.is_anonymous) {
    throw createError({ statusCode: 401, message: 'Sign in to change your username.' })
  }

  const { username, currentPassword } = await readBody(event)
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    throw createError({ statusCode: 400, message: 'Username must be 3–20 chars: letters, numbers, or underscore.' })
  }

  if (accountHasPassword(user)) {
    if (typeof currentPassword !== 'string' || !user.email || !(await verifyPassword(user.email, currentPassword))) {
      throw createError({ statusCode: 401, message: 'Current password is incorrect.' })
    }
  }

  const db = useServiceRoleClient()
  const { error } = await db
    .from('profiles')
    .upsert({ id: user.id, handle: username }, { onConflict: 'id' })

  if (error) {
    if (error.code === '23505') {
      throw createError({ statusCode: 409, message: 'That username is taken — pick another.' })
    }
    throw createError({ statusCode: 500, message: `Failed to update username: ${error.message}` })
  }

  return { handle: username }
})
