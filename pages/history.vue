<template>
  <section class="history-screen">
    <!-- Header -->
    <div class="history-top">
      <div>
        <div class="screen-eyebrow">// the_record</div>
        <h1 class="screen-title">session history</h1>
      </div>
      <div class="history-filters">
        <button
          v-for="f in filters"
          :key="f.key"
          class="filter-button"
          :class="{ 'filter-button--active': filter === f.key }"
          @click="filter = f.key"
        >
          {{ f.label }} · {{ f.count }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="empty-state">loading_</div>

    <div v-else-if="sessions.length === 0" class="empty-state empty-state--block">
      <p class="empty-lead">No completed sessions yet.</p>
      <p class="empty-sub">run a session to build your history</p>
    </div>

    <template v-else>
      <!-- Summary strip -->
      <div class="summary-strip">
        <div class="summary-card">
          <div class="summary-label">total_sessions</div>
          <div class="summary-value">{{ sessions.length }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">hits · #1_rank</div>
          <div class="summary-value summary-value--hit">{{ hitCount }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">hit_rate · vs 25%</div>
          <div class="summary-value">{{ hitRate }}<span class="summary-pct">%</span></div>
        </div>
      </div>

      <!-- List header -->
      <div class="list-header">
        <span>sketch</span>
        <span>target_reference</span>
        <span class="col-impressions">impressions</span>
        <span class="col-result">result</span>
      </div>

      <!-- Rows -->
      <NuxtLink
        v-for="s in filteredSessions"
        :key="s.id"
        :to="`/session/${s.id}/result`"
        class="session-row"
      >
        <div class="row-thumb">
          <img v-if="s.thumbnail_url" :src="s.thumbnail_url" :alt="`target for ${s.reference_number}`" loading="lazy" />
        </div>
        <div class="row-ref">
          <div class="row-ref-token">{{ refA(s.reference_number) }}<span class="ref-dash">—</span>{{ refB(s.reference_number) }}</div>
          <div class="row-date">{{ formatDate(s.created_at) }}</div>
        </div>
        <div class="row-impressions col-impressions">{{ s.category || '—' }}</div>
        <div class="col-result">
          <span class="result-chip" :class="s.hit ? 'result-chip--hit' : 'result-chip--miss'">
            {{ s.hit ? 'HIT' : 'miss' }} · #{{ s.target_rank ?? '—' }}
          </span>
        </div>
      </NuxtLink>
    </template>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()

interface HistorySession {
  id: string
  reference_number: string
  created_at: string
  hit: boolean
  target_rank: number | null
  category: string | null
  thumbnail_url: string | null
}

const sessions = ref<HistorySession[]>([])
const loading = ref(true)
const filter = ref<'all' | 'hit' | 'miss'>('all')
const lastSession = useState<{ reference_number: string; hit: boolean; date: string } | null>('lastSession', () => null)

const hitCount = computed(() => sessions.value.filter(s => s.hit).length)
const hitRate = computed(() =>
  sessions.value.length ? Math.round((hitCount.value / sessions.value.length) * 100) : 0,
)

const filters = computed(() => [
  { key: 'all' as const,  label: 'all',    count: sessions.value.length },
  { key: 'hit' as const,  label: 'hits',   count: hitCount.value },
  { key: 'miss' as const, label: 'misses', count: sessions.value.length - hitCount.value },
])

const filteredSessions = computed(() => {
  if (filter.value === 'all') return sessions.value
  return sessions.value.filter(s => (filter.value === 'hit' ? s.hit : !s.hit))
})

function refA(ref: string) { return ref.split('—')[0] ?? ref }
function refB(ref: string) { return ref.split('—')[1] ?? '' }

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toLowerCase()
}

onMounted(async () => {
  try {
    const data = await apiFetch<{ sessions: HistorySession[] }>('/api/history')
    sessions.value = data.sessions
    // Cache the most recent session for the home-screen meta line.
    const recent = data.sessions[0]
    if (recent) {
      lastSession.value = {
        reference_number: recent.reference_number,
        hit: recent.hit,
        date: formatDate(recent.created_at),
      }
    }
  }
  catch { /* silently empty */ }
  finally {
    loading.value = false
  }
})
</script>

<style scoped>
.history-screen {
  padding: clamp(40px, 6vw, 64px) clamp(22px, 6vw, 72px) clamp(48px, 7vw, 72px);
}

.history-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 20px;
}

.screen-eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 14px;
}

.screen-title {
  font-size: clamp(32px, 6vw, 46px);
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1;
  color: var(--psy-text-highlighted);
  margin: 0;
}

.history-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-button {
  padding: 9px 15px;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  cursor: pointer;
  border-radius: 2px;
  background: transparent;
  color: var(--psy-text-muted);
  border: 1px solid var(--psy-line-strong);
}

.filter-button--active {
  background: var(--psy-tan);
  color: var(--psy-bg);
  border-color: var(--psy-tan);
  font-weight: 600;
}

/* ── Summary strip ──────────────────────────────────────────────────────── */
.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 32px;
}

.summary-card {
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  padding: 20px 24px;
}

.summary-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--psy-text-faint);
}

.summary-value {
  font-size: 30px;
  font-weight: 900;
  color: var(--psy-text-highlighted);
  margin-top: 6px;
}

.summary-value--hit { color: var(--psy-hit); }

.summary-pct {
  font-size: 16px;
  color: var(--psy-text-muted);
}

/* ── List ───────────────────────────────────────────────────────────────── */
.list-header {
  display: grid;
  grid-template-columns: 62px 1fr 180px 130px;
  gap: 18px;
  padding: 18px 4px 12px;
  margin-top: 14px;
  border-bottom: 1px solid var(--psy-line);
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
}

.col-result { text-align: right; }

.session-row {
  display: grid;
  grid-template-columns: 62px 1fr 180px 130px;
  gap: 18px;
  align-items: center;
  padding: 16px 4px;
  border-bottom: 1px solid var(--psy-line);
  text-decoration: none;
  color: inherit;
  transition: background 0.12s;
}

.session-row:hover { background: var(--psy-bg-base); }

.row-thumb {
  height: 46px;
  border: 1px solid var(--psy-line);
  background: var(--psy-bg-inset);
  background-image: repeating-linear-gradient(0deg, var(--psy-bg-panel) 0 7px, transparent 7px 8px);
  overflow: hidden;
}

.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.row-ref-token {
  font-family: var(--psy-font-mono);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--psy-text);
}

.ref-dash { color: var(--psy-tan); }

.row-date {
  font-size: 12px;
  color: var(--psy-text-faint);
  margin-top: 4px;
}

.row-impressions {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--psy-text-muted);
}

.result-chip {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: 2px;
  white-space: nowrap;
}

.result-chip--hit {
  color: var(--psy-hit);
  border: 1px solid var(--psy-hit);
}

.result-chip--miss {
  color: var(--psy-miss);
  border: 1px solid var(--psy-line-strong);
}

/* ── Empty / loading ────────────────────────────────────────────────────── */
.empty-state {
  font-family: var(--psy-font-mono);
  color: var(--psy-text-faint);
  padding: 60px 0;
}

.empty-state--block { text-align: center; }

.empty-lead {
  font-size: 16px;
  color: var(--psy-text-muted);
}

.empty-sub {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-top: 8px;
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .list-header,
  .session-row {
    grid-template-columns: 50px 1fr auto;
    gap: 14px;
  }

  .col-impressions { display: none; }
}

@media (max-width: 520px) {
  .summary-strip { grid-template-columns: 1fr; gap: 12px; }
  .summary-card { padding: 16px 18px; }
}
</style>
