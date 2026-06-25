import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

/**
 * Claim a public username (profiles.handle) for the CURRENT user. Used during
 * sign_up before the email/password upgrade. Case-insensitive global uniqueness
 * is enforced by the profiles_handle_lower_key index → 409 if already taken.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const { username } = await readBody(event)

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    throw createError({ statusCode: 400, message: 'Username must be 3–20 chars: letters, numbers, or underscore.' })
  }

  const db = useServiceRoleClient()
  const { error } = await db
    .from('profiles')
    .upsert({ id: user.id, handle: username }, { onConflict: 'id' })

  if (error) {
    if (error.code === '23505') {
      throw createError({ statusCode: 409, message: 'That username is taken — pick another.' })
    }
    throw createError({ statusCode: 500, message: `Failed to set username: ${error.message}` })
  }

  return { ok: true, username }
})
