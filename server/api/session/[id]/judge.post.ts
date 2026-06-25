import { getServerUser } from '../../../utils/auth'
import { useServiceRoleClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const sessionId = getRouterParam(event, 'id')
  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, user_id, target_id, locked_at, judged_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })
  if (!session.locked_at) throw createError({ statusCode: 403, message: 'Session must be locked before judging' })
  if (session.judged_at) throw createError({ statusCode: 409, message: 'Session already judged' })

  const body = await readBody(event)
  // ranking: { [candidate_id]: rank }
  const ranking: Record<string, number> = body.ranking

  if (!ranking || typeof ranking !== 'object') {
    throw createError({ statusCode: 400, message: 'ranking must be an object mapping candidate_id → rank' })
  }

  const ranks = Object.values(ranking)
  if (ranks.length !== 4 || !ranks.includes(1) || !ranks.includes(2) || !ranks.includes(3) || !ranks.includes(4)) {
    throw createError({ statusCode: 400, message: 'Must rank all 4 candidates 1–4 with no ties' })
  }

  // Get candidates to find which is the target
  const { data: candidates } = await db
    .from('session_candidates')
    .select('id, is_target')
    .eq('session_id', sessionId)

  if (!candidates) throw createError({ statusCode: 500, message: 'Failed to load candidates' })

  const targetCandidate = candidates.find((c) => c.is_target)
  if (!targetCandidate) throw createError({ statusCode: 500, message: 'Target candidate not found' })

  const targetRank = ranking[targetCandidate.id]
  const hit = targetRank === 1

  // Record judgement
  const { error: jErr } = await db.from('judgements').insert({
    session_id: sessionId,
    judger_id: user.id,
    ranking,
    hit,
  })
  if (jErr) throw createError({ statusCode: 500, message: `Failed to save judgement: ${jErr.message}` })

  // Update candidate ranks
  for (const [candidateId, rank] of Object.entries(ranking)) {
    await db.from('session_candidates').update({ judged_rank: rank }).eq('id', candidateId)
  }

  // Mark session judged
  await db
    .from('sessions')
    .update({ judged_at: new Date().toISOString(), status: 'judged' })
    .eq('id', sessionId)

  return {
    hit,
    target_candidate_id: targetCandidate.id,
    target_rank: targetRank,
  }
})
