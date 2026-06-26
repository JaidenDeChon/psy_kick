import type { SupabaseClient } from '@supabase/supabase-js'
import { getSignedImageUrl } from './images'

const SIGNED_URL_EXPIRY = 300 // 5 minutes — enough time to rank

/**
 * Build the blind judging payload for a session: the recorded perceptions plus
 * four UNLABELLED candidates (signed URLs, slot order). `is_target` is never read
 * into the result — the true-target id stays server-side, exactly as in the
 * owner's own judge flow. The owner's identity is likewise omitted (anonymised).
 */
export async function loadReviewPayload(db: SupabaseClient, sessionId: string) {
  const { data: candidates } = await db
    .from('session_candidates')
    .select('id, image_id, slot')
    .eq('session_id', sessionId)
    .order('slot')

  if (!candidates || candidates.length !== 4) {
    throw createError({ statusCode: 500, message: 'Candidate data incomplete' })
  }

  const imageIds = candidates.map(c => c.image_id)
  const { data: images } = await db
    .from('targets')
    .select('id, storage_path')
    .in('id', imageIds)

  const pathById = Object.fromEntries((images ?? []).map(img => [img.id, img.storage_path]))

  const withUrls = await Promise.all(
    candidates.map(async (c) => {
      const path = pathById[c.image_id] ?? 'placeholder'
      return {
        id: c.id,
        slot: c.slot,
        image_url: await getSignedImageUrl(db, path, SIGNED_URL_EXPIRY),
      }
    }),
  )

  const { data: perceptions } = await db
    .from('session_perceptions')
    .select('gestalt_tags, sensory, dimensional_tags, sketch')
    .eq('session_id', sessionId)
    .single()

  return {
    session_id: sessionId,
    candidates: withUrls,
    perceptions: perceptions ?? { gestalt_tags: [], sensory: {}, dimensional_tags: [], sketch: [] },
  }
}
