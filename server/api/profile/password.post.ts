import { getServerUser, accountHasPassword } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { verifyPassword } from '../../utils/verify-password'

/**
 * Set or change the current user's password. Accounts that already have one must
 * confirm with the current password; OAuth-only accounts (e.g. Google) are
 * setting their first password, so the session is the proof. The write goes
 * through the service-role admin API (no client-side password handling).
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  if (user.is_anonymous) {
    throw createError({ statusCode: 401, message: 'Sign in to set a password.' })
  }

  const { currentPassword, newPassword } = await readBody(event)
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw createError({ statusCode: 400, message: 'New password must be at least 6 characters.' })
  }

  if (accountHasPassword(user)) {
    if (typeof currentPassword !== 'string' || !user.email || !(await verifyPassword(user.email, currentPassword))) {
      throw createError({ statusCode: 401, message: 'Current password is incorrect.' })
    }
  }

  const db = useServiceRoleClient()
  const { error } = await db.auth.admin.updateUserById(user.id, { password: newPassword })
  if (error) {
    throw createError({ statusCode: 500, message: `Failed to update password: ${error.message}` })
  }

  return { ok: true }
})
