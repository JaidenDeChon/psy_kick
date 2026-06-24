import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'
import { getSignedImageUrl } from '../../../utils/images'

const SIGNED_URL_EXPIRY = 120 // seconds

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  // Must be locked first
  const { data: session } = await db
    .from('sessions')
    .select('id, user_id, target_id, locked_at, revealed_at, reference_number')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  if (!session.locked_at) {
    throw createError({ statusCode: 403, message: 'Session must be locked before reveal' })
  }

  // Get target image path
  const { data: target } = await db
    .from('targets')
    .select('storage_path, caption')
    .eq('id', session.target_id)
    .single()

  if (!target) {
    throw createError({ statusCode: 500, message: 'Target image not found' })
  }

  const targetUrl = await getSignedImageUrl(db, target.storage_path, SIGNED_URL_EXPIRY)

  // Mark revealed (idempotent — update only if not yet set)
  if (!session.revealed_at) {
    await db
      .from('sessions')
      .update({ revealed_at: new Date().toISOString(), status: 'revealed' })
      .eq('id', sessionId)
  }

  return {
    target_url: targetUrl,
    caption: target.caption,
    reference_number: session.reference_number,
  }
})
