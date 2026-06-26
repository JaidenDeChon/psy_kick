import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { computeStats } from '../../utils/scoring'

// Operators need at least this many crowd-scored (quorum-met) sessions to appear
// publicly on the board. Until then their rate is "held" — shown only to them.
const QUALIFY_MIN = 20

interface Row {
  user_id: string
  handle: string
  n_eligible: number
  n_crowd_hits: number
}

function withStats(r: Row) {
  const stats = computeStats(r.n_crowd_hits, r.n_eligible)
  return {
    user_id: r.user_id,
    handle: r.handle,
    n: r.n_eligible,
    hits: r.n_crowd_hits,
    hit_rate: stats.hitRate,
    wilson_lower: stats.wilsonLower,
    p_value: stats.pValue,
    qualified: r.n_eligible >= QUALIFY_MIN,
  }
}

/**
 * Global leaderboard. Standing is computed ONLY from crowd-scored, quorum-met
 * sessions (never self-scores) and ranked by the Wilson lower bound — the same
 * honesty machinery the rest of the app uses. The `you` row reflects the
 * requester's own progress even while held off the public board.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  const { data, error } = await db
    .from('leaderboard_stats')
    .select('user_id, handle, n_eligible, n_crowd_hits')
  if (error) throw createError({ statusCode: 500, message: `Failed to load leaderboard: ${error.message}` })

  const all = (data ?? []).map(withStats)
  // Rank by Wilson lower bound; tie-break on raw rate then sample size.
  all.sort((a, b) =>
    b.wilson_lower - a.wilson_lower || b.hit_rate - a.hit_rate || b.n - a.n)

  const standings = all
    .filter(r => r.qualified)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // The requester's own row — synthesised at n=0 if they have no crowd-scored
  // sessions yet, so the page can always show their progress toward qualifying.
  const mine = all.find(r => r.user_id === user.id)
  const youRank = standings.find(r => r.user_id === user.id)?.rank ?? null
  const you = user.is_anonymous
    ? null
    : mine
      ? { ...mine, rank: youRank }
      : { ...withStats({ user_id: user.id, handle: '', n_eligible: 0, n_crowd_hits: 0 }), rank: null }

  return {
    standings,
    qualified_count: standings.length,
    qualify_min: QUALIFY_MIN,
    you,
  }
})
