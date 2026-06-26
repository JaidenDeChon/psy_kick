import { getServerUser, accountHasPassword } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

/** Account state for the settings page: username, private email, and whether a
 *  password exists (drives the change-vs-set password flow). */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  const { data: profile } = await db
    .from('profiles')
    .select('handle')
    .eq('id', user.id)
    .single()

  return {
    handle: profile?.handle ?? '',
    email: user.email ?? null,
    isAnonymous: !!user.is_anonymous,
    hasPassword: accountHasPassword(user),
  }
})
