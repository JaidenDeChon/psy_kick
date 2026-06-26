<template>
  <section class="lb-screen">
    <div class="lb-head">
      <div class="screen-eyebrow">// network · standings_and_activity</div>
      <h1 class="screen-title">leaderboard</h1>
      <p class="lb-sub">
        Operators ranked by their crowd-scored hit rate. Must have at least
        <span class="lb-sub-em">{{ qualifyMin }} crowd-scored sessions</span> to appear on the board.
      </p>
    </div>

    <div class="lb-grid">
      <!-- ── Standings ──────────────────────────────────────────────────── -->
      <div class="standings">
        <div class="standings-meta">
          <span>{{ qualifiedCount }} qualified</span>
        </div>

        <div class="standings-header">
          <span class="col-rank">rank</span>
          <span class="col-op">operator</span>
          <span class="col-sample">sample</span>
          <span class="col-bar">hit_rate · vs 25%</span>
          <span class="col-rate">rate</span>
        </div>

        <div v-if="loading" class="lb-empty">loading_</div>

        <template v-else>
          <div v-for="row in standings" :key="row.user_id" class="standings-row" :class="{ 'standings-row--me': you && row.user_id === you.user_id }">
            <span class="col-rank rank-num">{{ row.rank }}</span>
            <span class="col-op op-cell">
              <span class="op-avatar">{{ avatar(row.handle) }}</span>
              <span class="op-name">{{ row.handle }}</span>
            </span>
            <span class="col-sample sample">n = {{ row.n }}</span>
            <span class="col-bar"><RateBar :rate="row.hit_rate" /></span>
            <span class="col-rate rate-val">{{ pct(row.hit_rate) }}%</span>
          </div>

          <div v-if="standings.length === 0" class="lb-empty lb-empty--block">
            <p>No operators have qualified yet.</p>
            <p class="lb-empty-sub">the board opens once someone reaches {{ qualifyMin }} crowd-scored sessions</p>
          </div>

          <!-- you row — only shown when held off the board (qualified = highlighted above) -->
          <div v-if="you && !you.qualified" class="standings-row standings-row--you">
            <span class="col-rank rank-num">—</span>
            <span class="col-op op-cell">
              <span class="op-avatar op-avatar--you">y</span>
              <span class="op-name">you</span>
            </span>
            <span class="col-sample sample">n = {{ you.n }}</span>
            <span class="col-bar"><span class="bar-held" /></span>
            <span class="col-rate rate-val rate-val--held">held</span>
          </div>

          <div v-else-if="!you" class="standings-row standings-row--you">
            <span class="col-rank rank-num">—</span>
            <span class="col-op op-cell">
              <span class="op-avatar op-avatar--you">y</span>
              <span class="op-name">you</span>
            </span>
            <span class="col-sample sample">n = 0</span>
            <span class="col-bar"><span class="bar-held" /></span>
            <span class="col-rate rate-val rate-val--held">sign in</span>
          </div>
        </template>

        <!-- held note + progress -->
        <div v-if="you && !you.qualified" class="held-note">
          <p class="held-text">Your rate is held off the board until n ≥ {{ qualifyMin }}.</p>
          <div class="progress">
            <div class="progress-track"><div class="progress-fill" :style="{ width: progressPct + '%' }" /></div>
            <span class="progress-label">{{ you.n }} / {{ qualifyMin }} · {{ Math.max(0, qualifyMin - you.n) }} more to qualify</span>
          </div>
        </div>
        <div v-else-if="!you" class="held-note">
          <p class="held-text">Sign in with a confirmed account to enter the standings.</p>
        </div>
      </div>

      <!-- ── Following · Activity ───────────────────────────────────────── -->
      <aside class="activity">
        <div class="activity-head">
          <span class="activity-title">following · activity</span>
          <span class="activity-count">{{ followedCount }} followed</span>
        </div>

        <div class="activity-feed">
          <div v-if="loading" class="lb-empty">loading_</div>
          <template v-else-if="events.length">
            <div v-for="ev in events" :key="ev.id" class="activity-item">
              <span class="op-avatar op-avatar--sm">{{ avatar(ev.actor_handle) }}</span>
              <div class="activity-body">
                <!-- eventText returns fixed, controlled markup (no user input interpolated) -->
                <p class="activity-text"><span class="activity-actor">{{ ev.actor_handle }}</span> <span v-html="eventText(ev)" /></p>
                <p class="activity-meta">{{ ev.ref ? ev.ref + ' · ' : '' }}{{ timeAgo(ev.created_at) }}</p>
              </div>
            </div>
          </template>
          <div v-else class="activity-empty">
            <p>No activity yet.</p>
            <p class="lb-empty-sub">follow operators to see their hits, misses and released sessions here</p>
          </div>
        </div>

        <!-- awaiting judgment callout -->
        <div class="awaiting" :class="{ 'awaiting--off': awaitingCount === 0 }">
          <div class="awaiting-eyebrow">▣ awaiting_your_judgment</div>
          <p class="awaiting-text">
            {{ awaitingCount > 0
              ? `${awaitingCount} session${awaitingCount === 1 ? '' : 's'} need an independent judge.`
              : 'No sessions are waiting on you right now.' }}
          </p>
          <NuxtLink to="/review_others" class="awaiting-btn">review_others →</NuxtLink>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

interface Row {
  user_id: string; handle: string; n: number; hits: number
  hit_rate: number; wilson_lower: number; p_value: number; qualified: boolean; rank?: number | null
}
interface ActivityEvent {
  id: string; type: 'hit' | 'miss' | 'follow' | 'released'
  actor_handle: string; ref: string | null; created_at: string
}

const loading = ref(true)
const standings = ref<Row[]>([])
const you = ref<Row | null>(null)
const qualifiedCount = ref(0)
const qualifyMin = ref(20)
const events = ref<ActivityEvent[]>([])
const followedCount = ref(0)
const awaitingCount = ref(0)
const reviewQueueCount = useState<number>('reviewQueueCount', () => 0)

const progressPct = computed(() =>
  you.value ? Math.min(100, Math.round((you.value.n / qualifyMin.value) * 100)) : 0)

function avatar(handle: string) { return (handle?.charAt(0) || '?').toLowerCase() }
function pct(rate: number) { return Math.round((rate ?? 0) * 100) }

function eventText(ev: ActivityEvent) {
  switch (ev.type) {
    case 'hit': return 'scored a <span class="kw kw-hit">hit #1</span>'
    case 'miss': return 'scored a <span class="kw kw-miss">miss</span>'
    case 'follow': return 'started following you'
    case 'released': return 'released a session for review <span class="kw kw-signal">needs judges</span>'
  }
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

onMounted(async () => {
  try {
    const [lb, act, q] = await Promise.all([
      apiFetch<{ standings: Row[]; qualified_count: number; qualify_min: number; you: Row | null }>('/api/network/leaderboard'),
      apiFetch<{ events: ActivityEvent[]; followed_count: number }>('/api/network/activity'),
      apiFetch<{ count: number; eligible: boolean }>('/api/review/queue').catch(() => ({ count: 0, eligible: false })),
    ])
    standings.value = lb.standings
    you.value = lb.you
    qualifiedCount.value = lb.qualified_count
    qualifyMin.value = lb.qualify_min
    events.value = act.events
    followedCount.value = act.followed_count
    awaitingCount.value = q.count
    reviewQueueCount.value = q.count
  }
  catch { /* leave empty */ }
  finally { loading.value = false }
})
</script>

<style scoped>
.lb-screen { padding: clamp(40px, 6vw, 64px) clamp(22px, 6vw, 72px) clamp(48px, 7vw, 72px); }

.screen-eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--psy-text-faint); margin-bottom: 14px;
}
.screen-title {
  font-size: clamp(32px, 6vw, 46px); font-weight: 900; letter-spacing: -0.025em;
  line-height: 1; color: var(--psy-text-highlighted); margin: 0;
}
.lb-sub { font-size: 14px; color: var(--psy-text-muted); margin: 16px 0 0; max-width: 60ch; }
.lb-sub-em { color: var(--psy-tan); }

.lb-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 28px;
  margin-top: 34px;
  align-items: start;
}

/* ── Standings ───────────────────────────────────────────────────────────── */
.standings-meta {
  display: flex; justify-content: flex-end;
  font-family: var(--psy-font-mono); font-size: 11px; letter-spacing: 0.08em;
  color: var(--psy-text-faint); margin-bottom: 6px;
}

.standings-header, .standings-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 92px 200px 64px;
  gap: 14px;
  align-items: center;
}
.standings-header {
  padding: 12px 6px;
  border-bottom: 1px solid var(--psy-line);
  font-family: var(--psy-font-mono);
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--psy-text-faint);
}
.col-rate { text-align: right; }

.standings-row {
  padding: 16px 6px;
  border-bottom: 1px solid var(--psy-line);
}
.standings-row--me { background: var(--psy-bg-base); }
.standings-row--you { border-top: 1px solid var(--psy-line-strong); }

.rank-num { font-family: var(--psy-font-mono); font-size: 14px; color: var(--psy-text-muted); }

.op-cell { display: flex; align-items: center; gap: 11px; min-width: 0; }
.op-avatar {
  width: 26px; height: 26px; flex-shrink: 0;
  border: 1px solid var(--psy-line-strong); background: var(--psy-bg-panel);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--psy-font-mono); font-size: 11px; color: var(--psy-tan);
}
.op-avatar--you { color: var(--psy-text-muted); }
.op-avatar--sm { width: 24px; height: 24px; font-size: 10px; }
.op-name { font-size: 14px; color: var(--psy-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sample { font-family: var(--psy-font-mono); font-size: 12px; color: var(--psy-text-faint); }
.rate-val { font-family: var(--psy-font-mono); font-size: 14px; color: var(--psy-tan); }
.rate-val--held { color: var(--psy-text-faint); }

.bar-held {
  display: block; height: 8px;
  background-image: repeating-linear-gradient(135deg, var(--psy-line-strong) 0 4px, transparent 4px 8px);
  border: 1px solid var(--psy-line);
}

.lb-empty { font-family: var(--psy-font-mono); color: var(--psy-text-faint); padding: 28px 6px; }
.lb-empty--block { text-align: center; }
.lb-empty-sub {
  font-family: var(--psy-font-mono); font-size: 10px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--psy-text-faint); margin-top: 6px;
}

.held-note { margin-top: 22px; }
.held-text { font-size: 13px; color: var(--psy-text-muted); margin: 0 0 12px; }
.progress { display: flex; align-items: center; gap: 14px; }
.progress-track { flex: 1; height: 6px; background: var(--psy-bg-panel); border: 1px solid var(--psy-line); }
.progress-fill { height: 100%; background: var(--psy-tan); }
.progress-label { font-family: var(--psy-font-mono); font-size: 11px; color: var(--psy-text-faint); white-space: nowrap; }

/* ── Activity ────────────────────────────────────────────────────────────── */
.activity {
  border: 1px solid var(--psy-line);
  background: var(--psy-bg-base);
  padding: 18px;
}
.activity-head {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 14px; border-bottom: 1px solid var(--psy-line);
}
.activity-title {
  font-family: var(--psy-font-mono); font-size: 10px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--psy-text-faint);
}
.activity-count { font-family: var(--psy-font-mono); font-size: 10px; color: var(--psy-text-faint); }

.activity-feed { display: flex; flex-direction: column; }
.activity-item { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--psy-line); }
.activity-body { min-width: 0; }
.activity-text { font-size: 13px; line-height: 1.5; color: var(--psy-text-muted); margin: 0; }
.activity-actor { color: var(--psy-text); font-family: var(--psy-font-mono); font-size: 12px; }
.activity-meta { font-family: var(--psy-font-mono); font-size: 10px; color: var(--psy-text-faint); margin: 4px 0 0; }
.activity-empty { padding: 22px 2px; }
.activity-empty p { font-size: 13px; color: var(--psy-text-muted); margin: 0; }

.awaiting {
  margin-top: 18px;
  border: 1px solid var(--psy-signal);
  padding: 16px;
}
.awaiting--off { border-color: var(--psy-line-strong); }
.awaiting-eyebrow {
  font-family: var(--psy-font-mono); font-size: 10px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--psy-signal); margin-bottom: 8px;
}
.awaiting--off .awaiting-eyebrow { color: var(--psy-text-faint); }
.awaiting-text { font-size: 13px; color: var(--psy-text-muted); margin: 0 0 14px; }
.awaiting-btn {
  display: block; text-align: center;
  font-family: var(--psy-font-mono); font-size: 12px; letter-spacing: 0.06em;
  padding: 10px; border: 1px solid var(--psy-signal); color: var(--psy-signal);
  text-decoration: none; border-radius: 2px;
}
.awaiting-btn:hover { background: var(--psy-signal-wash); }
.awaiting--off .awaiting-btn { border-color: var(--psy-line-strong); color: var(--psy-text-muted); }

/* keyword colours inside feed text (un-scoped via :deep) */
:deep(.kw) { font-family: var(--psy-font-mono); font-size: 12px; }
:deep(.kw-hit) { color: var(--psy-signal); }
:deep(.kw-miss) { color: var(--psy-miss); }
:deep(.kw-signal) { color: var(--psy-signal); }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 1040px) {
  .lb-grid { grid-template-columns: 1fr; }
  .activity { max-width: 560px; }
}
@media (max-width: 620px) {
  .standings-header { display: none; }
  .standings-row {
    grid-template-columns: 30px minmax(0, 1fr) 56px;
    grid-template-areas:
      "rank op rate"
      "rank bar bar"
      "rank sample sample";
    row-gap: 8px;
  }
  .col-rank { grid-area: rank; align-self: start; }
  .col-op { grid-area: op; }
  .col-rate { grid-area: rate; }
  .col-bar { grid-area: bar; }
  .col-sample { grid-area: sample; }
}
</style>
