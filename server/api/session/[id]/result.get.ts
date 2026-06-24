import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'
import { computeStats } from '../../../utils/scoring'
import { getSignedImageUrl } from '../../../utils/images'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, user_id, target_id, reference_number, judged_at, notes')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })
  if (!session.judged_at) throw createError({ statusCode: 403, message: 'Session not yet judged' })

  // Get judgement
  const { data: judgement } = await db
    .from('judgements')
    .select('hit, ranking')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!judgement) throw createError({ statusCode: 500, message: 'Judgement not found' })

  // Get target candidate (ranked slot)
  const { data: targetCand } = await db
    .from('session_candidates')
    .select('id, judged_rank')
    .eq('session_id', sessionId)
    .eq('is_target', true)
    .single()

  // Get target image signed URL
  const { data: target } = await db
    .from('targets')
    .select('storage_path, caption, category')
    .eq('id', session.target_id)
    .single()

  const targetUrl = target
    ? await getSignedImageUrl(db, target.storage_path, 300)
    : null

  // Get sketch data
  const { data: perceptions } = await db
    .from('session_perceptions')
    .select('sketch, gestalt_tags, sensory, dimensional_tags')
    .eq('session_id', sessionId)
    .single()

  // Compute running stats for this user
  const { data: allJudgements } = await db
    .from('judgements')
    .select('hit, session_id')
    .eq('judger_id', user.id)

  const n = allJudgements?.length ?? 0
  const hits = allJudgements?.filter((j) => j.hit).length ?? 0
  const stats = computeStats(hits, n)

  return {
    hit: judgement.hit,
    target_rank: targetCand?.judged_rank ?? null,
    reference_number: session.reference_number,
    target_url: targetUrl,
    target_caption: target?.caption ?? null,
    target_category: target?.category ?? null,
    sketch: perceptions?.sketch ?? [],
    gestalt_tags: perceptions?.gestalt_tags ?? [],
    sensory: perceptions?.sensory ?? {},
    dimensional_tags: perceptions?.dimensional_tags ?? [],
    running_stats: stats,
  }
})
