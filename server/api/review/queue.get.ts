import { getServerUser, isCloudVerified } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

/**
 * How many sessions are currently awaiting this judge — drives the nav badge and
 * the review_others intro count. Anonymous / unverified users can't judge, so the
 * queue is empty for them (no error: the page surfaces its own sign-in gate).
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  if (!isCloudVerified(user)) return { count: 0, eligible: false }

  const db = useServiceRoleClient()
  const { data, error } = await db.rpc('review_queue', { judge: user.id })
  if (error) throw createError({ statusCode: 500, message: `Failed to load queue: ${error.message}` })

  return { count: (data ?? []).length, eligible: true }
})
