import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { getSignedImageUrl } from '../../utils/images'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  // Get all completed sessions with judgement results. A session is complete
  // once it has been revealed — the final step after judging.
  const { data: sessions } = await db
    .from('sessions')
    .select('id, reference_number, created_at, status, target_id, allow_public_scoring')
    .eq('user_id', user.id)
    .eq('status', 'revealed')
    .order('created_at', { ascending: false })

  if (!sessions) return { sessions: [] }

  // Get judgements
  const sessionIds = sessions.map((s) => s.id)
  const { data: judgements } = await db
    .from('judgements')
    .select('session_id, hit')
    .in('session_id', sessionIds)
    .eq('judger_id', user.id)

  const hitBySession = Object.fromEntries(
    (judgements ?? []).map((j) => [j.session_id, j.hit])
  )

  // Get target candidate ranks
  const { data: candidates } = await db
    .from('session_candidates')
    .select('session_id, judged_rank')
    .in('session_id', sessionIds)
    .eq('is_target', true)

  const rankBySession = Object.fromEntries(
    (candidates ?? []).map((c) => [c.session_id, c.judged_rank])
  )

  // Get target categories
  const targetIds = sessions.map((s) => s.target_id)
  const { data: targets } = await db
    .from('targets')
    .select('id, category, storage_path')
    .in('id', targetIds)

  // Mint thumbnail URLs for revealed sessions (falls back to placeholder)
  const thumbnailUrls: Record<string, string> = {}
  await Promise.all(
    (targets ?? []).map(async (t) => {
      thumbnailUrls[t.id] = await getSignedImageUrl(db, t.storage_path, 3600)
    })
  )

  const targetById = Object.fromEntries((targets ?? []).map((t) => [t.id, t]))

  // Crowd score per session — the aggregate of OTHER viewers' blind judgements.
  // Renders as "--" (pending) until quorum (n ≥ 5); the view already excludes the
  // owner's own self-judgement from the crowd count.
  const { data: crowd } = await db
    .from('session_crowd_stats')
    .select('session_id, n_judgments, n_hits, hit_rate, quorum_met')
    .in('session_id', sessionIds)
  const crowdBySession = Object.fromEntries((crowd ?? []).map((c) => [c.session_id, c]))

  return {
    sessions: sessions.map((s) => {
      const c = crowdBySession[s.id]
      return {
        id: s.id,
        reference_number: s.reference_number,
        created_at: s.created_at,
        hit: hitBySession[s.id] ?? false,
        target_rank: rankBySession[s.id] ?? null,
        category: targetById[s.target_id]?.category ?? null,
        thumbnail_url: thumbnailUrls[s.target_id] ?? null,
        allow_public_scoring: s.allow_public_scoring ?? true,
        crowd: {
          n: c?.n_judgments ?? 0,
          hits: c?.n_hits ?? 0,
          hit_rate: c?.hit_rate != null ? Number(c.hit_rate) : null,
          quorum_met: c?.quorum_met ?? false,
        },
      }
    }),
  }
})
