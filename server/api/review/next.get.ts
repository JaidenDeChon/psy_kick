import { getServerUser, requireCloudVerified } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { loadReviewPayload } from '../../utils/review'

/**
 * Hand the judge the next session from the pool — the judge never chooses whose
 * session they get (anti-targeting, §4). The pool prioritises under-quorum
 * sessions. Returns the blind payload + how many remain available to this judge.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  requireCloudVerified(user)

  const db = useServiceRoleClient()
  const { data: queue, error } = await db.rpc('review_queue', { judge: user.id })
  if (error) throw createError({ statusCode: 500, message: `Failed to load queue: ${error.message}` })

  const rows = queue ?? []
  const next = rows[0]
  if (!next) return { session: null, remaining: 0 }

  const payload = await loadReviewPayload(db, next.session_id)
  return { session: payload, remaining: rows.length }
})
