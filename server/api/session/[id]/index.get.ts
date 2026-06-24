import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, reference_number, status, created_at, locked_at, revealed_at, judged_at, notes')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })

  const { data: perceptions } = await db
    .from('session_perceptions')
    .select('gestalt_tags, sensory, dimensional_tags, ideogram, sketch')
    .eq('session_id', sessionId)
    .single()

  const { data: aol } = await db
    .from('session_aol')
    .select('entries')
    .eq('session_id', sessionId)
    .single()

  return {
    ...session,
    perceptions: perceptions ?? { gestalt_tags: [], sensory: {}, dimensional_tags: [], ideogram: [], sketch: [] },
    aol: aol?.entries ?? [],
  }
})
