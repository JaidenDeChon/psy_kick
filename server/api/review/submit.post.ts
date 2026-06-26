import { getServerUser, requireCloudVerified } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

/**
 * Record one blind crowd-judgement. The session must be in THIS judge's
 * server-assigned queue (re-checked here, not trusted from the client): locked,
 * owner cloud + verified and opted-in, not the judge's own, not already judged by
 * them. The hit is computed server-side from `is_target` — which is never sent to
 * the client. Per decision-log #11 the judge gets their own result immediately.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  requireCloudVerified(user)

  const body = await readBody(event)
  const sessionId: string | undefined = body?.session_id
  const ranking: Record<string, number> = body?.ranking

  if (!sessionId) throw createError({ statusCode: 400, message: 'session_id is required' })
  if (!ranking || typeof ranking !== 'object') {
    throw createError({ statusCode: 400, message: 'ranking must map candidate_id → rank' })
  }
  const ranks = Object.values(ranking)
  if (ranks.length !== 4 || ![1, 2, 3, 4].every(r => ranks.includes(r))) {
    throw createError({ statusCode: 400, message: 'Must rank all 4 candidates 1–4 with no ties' })
  }

  const db = useServiceRoleClient()

  // Eligibility — the session must currently be in this judge's queue. This single
  // check enforces every pool rule (locked, opted-in, owner verified, not own, not
  // already judged) from one source of truth.
  const { data: queue, error: qErr } = await db.rpc('review_queue', { judge: user.id })
  if (qErr) throw createError({ statusCode: 500, message: `Failed to verify queue: ${qErr.message}` })
  const rows = queue ?? []
  if (!rows.some((r: { session_id: string }) => r.session_id === sessionId)) {
    throw createError({ statusCode: 409, message: 'This session is no longer available to judge.' })
  }

  // Find the true target (server-only) and score the ranking.
  const { data: candidates } = await db
    .from('session_candidates')
    .select('id, is_target')
    .eq('session_id', sessionId)
  if (!candidates || candidates.length !== 4) {
    throw createError({ statusCode: 500, message: 'Candidate data incomplete' })
  }
  const target = candidates.find(c => c.is_target)
  if (!target) throw createError({ statusCode: 500, message: 'Target candidate not found' })

  // Every submitted candidate id must belong to this session (no ties already checked).
  const validIds = new Set(candidates.map(c => c.id))
  if (Object.keys(ranking).length !== 4 || !Object.keys(ranking).every(id => validIds.has(id))) {
    throw createError({ statusCode: 400, message: 'Ranking does not match this session’s candidates' })
  }

  const targetRank = ranking[target.id]
  const hit = targetRank === 1

  // Insert the crowd judgement. unique(session_id, judger_id) defends against a
  // double-submit race. Note: we DON'T touch judged_rank / judged_at / status —
  // those belong to the owner's own self-judge flow.
  const { error: jErr } = await db.from('judgements').insert({
    session_id: sessionId,
    judger_id: user.id,
    ranking,
    hit,
  })
  if (jErr) {
    if (jErr.code === '23505') {
      throw createError({ statusCode: 409, message: 'You have already judged this session.' })
    }
    throw createError({ statusCode: 500, message: `Failed to save judgement: ${jErr.message}` })
  }

  // remaining = the queue minus the session just judged.
  const remaining = rows.length - 1

  return {
    hit,
    target_candidate_id: target.id,
    target_rank: targetRank,
    remaining,
  }
})
