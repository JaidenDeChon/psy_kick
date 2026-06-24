import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'
import { getSignedImageUrl } from '../../../utils/images'

const SIGNED_URL_EXPIRY = 300 // 5 minutes — enough time to rank

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, user_id, locked_at, reference_number')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  if (!session.locked_at) {
    throw createError({ statusCode: 403, message: 'Session must be locked before viewing candidates' })
  }

  // Get all 4 candidates with image paths — is_target deliberately NOT returned to client
  const { data: candidates } = await db
    .from('session_candidates')
    .select('id, image_id, slot')
    .eq('session_id', sessionId)
    .order('slot')

  if (!candidates || candidates.length !== 4) {
    throw createError({ statusCode: 500, message: 'Candidate data incomplete' })
  }

  // Get image paths
  const imageIds = candidates.map((c) => c.image_id)
  const { data: images } = await db
    .from('targets')
    .select('id, storage_path')
    .in('id', imageIds)

  if (!images) {
    throw createError({ statusCode: 500, message: 'Failed to load target images' })
  }

  const pathById = Object.fromEntries(images.map((img) => [img.id, img.storage_path]))

  // Mint signed URLs for all 4 (falls back to placeholder if file absent)
  const withUrls = await Promise.all(
    candidates.map(async (c) => {
      const path = pathById[c.image_id] ?? 'placeholder'
      const imageUrl = await getSignedImageUrl(db, path, SIGNED_URL_EXPIRY)
      return {
        id: c.id,
        slot: c.slot,
        image_url: imageUrl,
      }
    })
  )

  // Return in slot order — is_target stays server-side
  return {
    candidates: withUrls,
    reference_number: session.reference_number,
  }
})
