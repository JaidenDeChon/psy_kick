import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'

/**
 * Owner control over the opt-out judging pool (§5.3): toggle whether others may
 * score this session. Default on. Turning it off stops NEW judgements; any
 * existing crowd-score is kept-but-frozen (still shown to the owner) — the
 * crowd-stat view simply stops growing because the queue excludes the session.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const allow: boolean = body?.allow !== false

  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })

  const { error } = await db
    .from('sessions')
    .update({ allow_public_scoring: allow })
    .eq('id', sessionId)
  if (error) throw createError({ statusCode: 500, message: `Failed to update: ${error.message}` })

  return { allow_public_scoring: allow }
})
