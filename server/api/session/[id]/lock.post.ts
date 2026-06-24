import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, user_id, locked_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  if (session.locked_at) {
    // Already locked — idempotent OK
    return { locked: true, already_locked: true }
  }

  const { error } = await db
    .from('sessions')
    .update({ locked_at: new Date().toISOString(), status: 'locked' })
    .eq('id', sessionId)

  if (error) {
    throw createError({ statusCode: 500, message: `Failed to lock session: ${error.message}` })
  }

  return { locked: true }
})
