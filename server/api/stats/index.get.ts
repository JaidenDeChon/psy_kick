import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { computeStats } from '../../utils/scoring'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  // Self-judgements only — a judgement on one's OWN session. Crowd judgements this
  // user cast on other people's sessions must not inflate their personal RV stats.
  const { data: judgements } = await db
    .from('judgements')
    .select('hit, created_at, session_id, sessions!inner(user_id)')
    .eq('judger_id', user.id)
    .eq('sessions.user_id', user.id)
    .order('created_at', { ascending: true })

  const n = judgements?.length ?? 0
  const hits = judgements?.filter((j) => j.hit).length ?? 0
  const stats = computeStats(hits, n)

  // Cumulative hit rate over time for chart
  const cumulative: { n: number; rate: number }[] = []
  let cumulativeHits = 0
  for (let i = 0; i < (judgements?.length ?? 0); i++) {
    if (judgements![i]!.hit) cumulativeHits++
    cumulative.push({ n: i + 1, rate: cumulativeHits / (i + 1) })
  }

  return {
    stats,
    cumulative,
  }
})
