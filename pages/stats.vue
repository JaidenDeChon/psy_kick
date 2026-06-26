<template>
  <section class="stats-screen">
    <div class="screen-eyebrow">// your_scores_vs_chance</div>
    <h1 class="screen-title">stats</h1>

    <div v-if="loading" class="empty-state">loading_</div>

    <div v-else-if="!hasData" class="empty-state empty-state--block">
      <p class="empty-lead">No judged sessions yet.</p>
      <p class="empty-sub">your scores appear here once you complete the loop</p>
    </div>

    <template v-else>
      <!-- Headline numbers -->
      <div class="headline">
        <div class="headline-rate">
          <div class="headline-big">
            {{ ratePct }}<span class="headline-pct">%</span>
          </div>
          <div class="headline-cap">hit_rate</div>
        </div>
        <div class="headline-col">
          <div class="headline-mono headline-mono--tan">n = {{ stats!.n }}</div>
          <div class="headline-cap">{{ stats!.n < 30 ? '(small sample size)' : 'sample size' }}</div>
        </div>
        <div class="headline-col">
          <div class="headline-mono headline-mono--muted">25%</div>
          <div class="headline-cap">chance · baseline</div>
        </div>
      </div>

      <!-- Cumulative chart -->
      <div class="chart-section">
        <div class="chart-label">cumulative_rate vs 25% baseline</div>
        <div class="chart-plot">
          <div class="chart-baseline"></div>
          <div class="chart-baseline-tag">25% chance</div>
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" class="chart-svg">
            <polyline :points="chartPoints" fill="none" stroke="var(--psy-signal)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            <circle v-if="lastPoint" :cx="lastPoint.x" :cy="lastPoint.y" r="4.5" fill="var(--psy-signal)" />
          </svg>
        </div>
        <div class="chart-axis">
          <span v-for="lbl in axisLabels" :key="lbl">{{ lbl }}</span>
        </div>
      </div>

      <!-- Callout -->
      <div class="callout">
        <span class="tan">You don't have many sessions yet</span>, so these scores will be less helpful (for now). You should have about 30 sessions for a confident signal to arise. Keep viewing!
      </div>

      <!-- Statistics detail (quiet) -->
      <div class="detail">
        <div class="detail-head">
          <div class="detail-label">// statistics_detail</div>
          <button class="detail-info" @click="showInfo = true">ⓘ what these mean</button>
        </div>
        <div class="detail-rows">
          <div class="detail-row">
            <span class="detail-key">95% wilson_ci</span>
            <span class="detail-val">[ {{ pct(stats!.wilsonLower) }}% – {{ pct(stats!.wilsonUpper) }}% ]</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">p-value · one-sided</span>
            <span class="detail-val detail-val--faint">{{ stats!.pValue.toFixed(3) }}</span>
          </div>
        </div>
      </div>

      <!-- Leaderboard -->
      <div class="leaderboard">
        <div class="leaderboard-label">// leaderboard · sustained_only</div>
        <div class="leaderboard-sub">
          Gated to <span class="tan">n ≥ 20</span> so lucky streaks don't rank. You appear once you qualify.
        </div>
        <div class="leaderboard-table">
          <div v-for="(row, i) in leaders" :key="row.name" class="leaderboard-row">
            <span class="lb-rank" :class="{ 'lb-rank--lead': i === 0 }">{{ i + 1 }}</span>
            <span class="lb-name">{{ row.name }}</span>
            <span class="lb-n">n = {{ row.n }}</span>
            <span class="lb-rate">{{ row.rate }}%</span>
          </div>
          <div class="leaderboard-row leaderboard-row--you">
            <span class="lb-rank lb-rank--faint">{{ qualified ? '·' : '—' }}</span>
            <span class="lb-name lb-name--you">you</span>
            <span class="lb-n">n = {{ stats!.n }}</span>
            <span class="lb-rate" :class="qualified ? 'lb-rate--you' : 'lb-rate--faint'">
              {{ qualified ? ratePct + '%' : 'keep going' }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <StatsInfoModal v-model="showInfo" />
  </section>
</template>

<script setup lang="ts">
import type { RunningStats } from '~/server/utils/scoring'

const { apiFetch } = useApi()

const stats = ref<RunningStats | null>(null)
const cumulative = ref<{ n: number; rate: number }[]>([])
const loading = ref(true)
const showInfo = ref(false)

// Sample standings — cross-user ranking is gated to n ≥ 20 (the v1 leaderboard
// is a quiet concept surface; live ranking arrives with account upgrade).
const leaders = [
  { name: 'm_okafor', n: 64, rate: 37 },
  { name: 'd_rivera', n: 41, rate: 34 },
  { name: 'a_voss',   n: 28, rate: 32 },
]

const hasData = computed(() => !!stats.value && stats.value.n > 0)
const qualified = computed(() => (stats.value?.n ?? 0) >= 20)
const ratePct = computed(() => (stats.value ? Math.round(stats.value.hitRate * 100) : 0))

function pct(v: number) { return Math.round(v * 100) }

// Chart: viewBox 600×200, y=0 → 100%, y=200 → 0%.
const chartPoints = computed(() => {
  const pts = cumulative.value
  if (!pts.length) return ''
  return pts
    .map((p, i) => {
      const x = (i / Math.max(pts.length - 1, 1)) * 600
      const y = (1 - p.rate) * 200
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const lastPoint = computed(() => {
  const pts = cumulative.value
  if (!pts.length) return null
  const i = pts.length - 1
  return { x: (i / Math.max(pts.length - 1, 1)) * 600, y: (1 - pts[i]!.rate) * 200 }
})

const axisLabels = computed(() => {
  const total = cumulative.value.length
  if (total <= 1) return total === 1 ? ['s1'] : []
  if (total <= 8) return cumulative.value.map((_, i) => `s${i + 1}`)
  // sample ~6 evenly-spaced ticks for longer runs
  const ticks = 6
  return Array.from({ length: ticks }, (_, k) => {
    const idx = Math.round((k / (ticks - 1)) * (total - 1))
    return `s${idx + 1}`
  })
})

onMounted(async () => {
  try {
    const data = await apiFetch<{ stats: RunningStats; cumulative: { n: number; rate: number }[] }>('/api/stats')
    stats.value = data.stats
    cumulative.value = data.cumulative
  }
  catch { /* empty state */ }
  finally {
    loading.value = false
  }
})
</script>

<style scoped>
.stats-screen {
  padding: clamp(40px, 6vw, 64px) clamp(22px, 6vw, 72px) clamp(48px, 7vw, 72px);
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

.tan { color: var(--psy-tan); }

/* ── Headline ───────────────────────────────────────────────────────────── */
.headline {
  display: flex;
  align-items: flex-end;
  gap: 44px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--psy-line);
  padding: 34px 0 30px;
  margin-top: 24px;
}

.headline-big {
  font-size: clamp(56px, 11vw, 72px);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 0.9;
  color: var(--psy-text-highlighted);
}

.headline-pct {
  font-size: clamp(26px, 5vw, 32px);
  color: var(--psy-text-muted);
}

.headline-col { padding-bottom: 8px; }

.headline-mono {
  font-family: var(--psy-font-mono);
  font-size: 22px;
}

.headline-mono--tan { color: var(--psy-tan); }
.headline-mono--muted { color: var(--psy-text-muted); }

.headline-cap {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--psy-text-faint);
  margin-top: 8px;
}

.headline-rate .headline-cap { margin-top: 10px; }

/* ── Chart ──────────────────────────────────────────────────────────────── */
.chart-section { margin-top: 36px; }

.chart-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 20px;
}

.chart-plot {
  position: relative;
  height: 200px;
  border-left: 1px solid var(--psy-line);
  border-bottom: 1px solid var(--psy-line);
}

.chart-baseline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 25%;
  border-top: 1px dashed var(--psy-tan);
}

.chart-baseline-tag {
  position: absolute;
  right: 0;
  bottom: 25%;
  transform: translateY(-50%);
  font-family: var(--psy-font-mono);
  font-size: 9px;
  color: var(--psy-tan);
  background: var(--psy-bg);
  padding: 2px 5px;
}

.chart-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  font-family: var(--psy-font-mono);
  font-size: 9px;
  color: var(--psy-text-faint);
  margin-top: 8px;
  padding-left: 2px;
}

/* ── Callout ────────────────────────────────────────────────────────────── */
.callout {
  margin-top: 24px;
  border-left: 2px solid var(--psy-tan);
  background: var(--psy-bg-panel);
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--psy-text-muted);
  max-width: 720px;
}

/* ── Detail ─────────────────────────────────────────────────────────────── */
.detail { margin-top: 32px; }

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
}

.detail-info {
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  color: var(--psy-text-faint);
}

.detail-info:hover { color: var(--psy-tan); }

.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 420px;
}

.detail-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--psy-line);
}

.detail-key {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--psy-text-faint);
}

.detail-val {
  font-family: var(--psy-font-mono);
  font-size: 13px;
  color: var(--psy-text-muted);
}

.detail-val--faint { color: var(--psy-text-faint); }

/* ── Leaderboard ────────────────────────────────────────────────────────── */
.leaderboard { margin-top: 48px; }

.leaderboard-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 8px;
}

.leaderboard-sub {
  font-size: 13px;
  color: var(--psy-text-faint);
  margin-bottom: 18px;
}

.leaderboard-table { border: 1px solid var(--psy-line); }

.leaderboard-row {
  display: grid;
  grid-template-columns: 40px 1fr 120px 90px;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--psy-line);
  font-family: var(--psy-font-mono);
  font-size: 14px;
}

.leaderboard-row:first-child { background: var(--psy-bg-panel); }
.leaderboard-row:last-child { border-bottom: none; }

.leaderboard-row--you {
  background: var(--psy-bg-base);
  border: 1px dashed var(--psy-line-strong);
}

.lb-rank { color: var(--psy-text-muted); }
.lb-rank--lead { color: var(--psy-tan); }
.lb-rank--faint { color: var(--psy-text-faint); }

.lb-name {
  font-family: var(--psy-font-sans);
  color: var(--psy-text);
}

.lb-name--you { color: var(--psy-text-muted); }

.lb-n { color: var(--psy-text-faint); }

.lb-rate {
  color: var(--psy-signal);
  text-align: right;
}

.lb-rate--you { color: var(--psy-signal); text-align: right; }
.lb-rate--faint { color: var(--psy-text-faint); text-align: right; white-space: nowrap; }

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
@media (max-width: 600px) {
  .headline { gap: 28px; }
  .leaderboard-row {
    grid-template-columns: 28px 1fr auto;
    gap: 12px;
    padding: 14px 16px;
  }
  .lb-n { display: none; }
}
</style>
