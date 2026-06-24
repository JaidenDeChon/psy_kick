import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  // Verify ownership and not locked
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
    throw createError({ statusCode: 403, message: 'Session is locked' })
  }

  const body = await readBody(event)

  // Update perceptions
  if (body.perceptions !== undefined) {
    const { error } = await db
      .from('session_perceptions')
      .upsert({
        session_id: sessionId,
        gestalt_tags: body.perceptions.gestalt_tags ?? [],
        sensory: body.perceptions.sensory ?? {},
        dimensional_tags: body.perceptions.dimensional_tags ?? [],
        ideogram: body.perceptions.ideogram ?? [],
        sketch: body.perceptions.sketch ?? [],
      })

    if (error) {
      throw createError({ statusCode: 500, message: `Failed to save perceptions: ${error.message}` })
    }
  }

  // Update AOL
  if (body.aol !== undefined) {
    const { error } = await db
      .from('session_aol')
      .upsert({ session_id: sessionId, entries: body.aol })

    if (error) {
      throw createError({ statusCode: 500, message: `Failed to save AOL: ${error.message}` })
    }
  }

  // Update notes
  if (body.notes !== undefined) {
    const { error } = await db
      .from('sessions')
      .update({ notes: body.notes })
      .eq('id', sessionId)

    if (error) {
      throw createError({ statusCode: 500, message: `Failed to save notes: ${error.message}` })
    }
  }

  return { saved: true }
})
