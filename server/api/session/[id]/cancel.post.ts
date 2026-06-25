import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, user_id, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  if (session.status === 'revealed') {
    // A completed, scored session lives in history — not cancellable.
    throw createError({ statusCode: 409, message: 'Session is already complete and cannot be cancelled.' })
  }

  // Discard the session; candidates / perceptions / aol cascade on delete.
  const { error } = await db
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    throw createError({ statusCode: 500, message: `Failed to cancel session: ${error.message}` })
  }

  return { cancelled: true }
})
