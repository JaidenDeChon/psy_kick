import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

interface ActivityEvent {
  id: string
  type: 'hit' | 'miss' | 'follow' | 'released'
  actor_handle: string
  ref: string | null
  created_at: string
}

/**
 * Read-only feed of recent activity from the people the requester follows, plus
 * new followers. Judging never happens here — watching and judging are kept
 * separate by design (anti-collusion, §5.1). Empty until there's follow data.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  if (user.is_anonymous) return { events: [], followed_count: 0 }

  const db = useServiceRoleClient()

  const { data: following } = await db
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id)
  const followeeIds = (following ?? []).map(f => f.followee_id)

  const { data: followers } = await db
    .from('follows')
    .select('follower_id, created_at')
    .eq('followee_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Resolve all the handles we'll need in one pass.
  const handleIds = [...new Set([...followeeIds, ...(followers ?? []).map(f => f.follower_id)])]
  const handleById: Record<string, string> = {}
  if (handleIds.length) {
    const { data: profiles } = await db.from('profiles').select('id, handle').in('id', handleIds)
    for (const p of profiles ?? []) handleById[p.id] = p.handle
  }

  const events: ActivityEvent[] = []

  // New followers → "started following you".
  for (const f of followers ?? []) {
    events.push({
      id: `follow:${f.follower_id}`,
      type: 'follow',
      actor_handle: handleById[f.follower_id] ?? 'operator',
      ref: null,
      created_at: f.created_at,
    })
  }

  if (followeeIds.length) {
    // Followees' own results (their self-judgements on their own sessions).
    const { data: judged } = await db
      .from('judgements')
      .select('judger_id, hit, created_at, sessions!inner(user_id, reference_number)')
      .in('judger_id', followeeIds)
      .order('created_at', { ascending: false })
      .limit(40)

    for (const j of (judged ?? []) as unknown as Array<{
      judger_id: string; hit: boolean; created_at: string
      sessions: { user_id: string; reference_number: string }
    }>) {
      if (j.sessions.user_id !== j.judger_id) continue // self-judgements only
      events.push({
        id: `judge:${j.judger_id}:${j.created_at}`,
        type: j.hit ? 'hit' : 'miss',
        actor_handle: handleById[j.judger_id] ?? 'operator',
        ref: j.sessions.reference_number,
        created_at: j.created_at,
      })
    }

    // Followees' sessions still in the pool needing judges.
    const { data: pool } = await db
      .from('session_crowd_stats')
      .select('session_id, owner_id, n_judgments, quorum_met')
      .in('owner_id', followeeIds)
    const underQuorum = (pool ?? []).filter(p => !p.quorum_met).map(p => p.session_id)
    if (underQuorum.length) {
      const { data: openSessions } = await db
        .from('sessions')
        .select('id, user_id, reference_number, locked_at')
        .in('id', underQuorum)
        .eq('allow_public_scoring', true)
        .not('locked_at', 'is', null)
        .order('locked_at', { ascending: false })
        .limit(10)
      for (const s of openSessions ?? []) {
        events.push({
          id: `released:${s.id}`,
          type: 'released',
          actor_handle: handleById[s.user_id] ?? 'operator',
          ref: s.reference_number,
          created_at: s.locked_at as string,
        })
      }
    }
  }

  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { events: events.slice(0, 12), followed_count: followeeIds.length }
})
