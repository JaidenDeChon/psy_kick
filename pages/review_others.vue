<template>
  <section class="review-screen">
    <!-- Header -->
    <div class="review-head">
      <div>
        <div class="screen-eyebrow">// blind_corroboration · server_assigned</div>
        <h1 class="screen-title">review_others</h1>
      </div>
      <div v-if="state === 'ranking' || state === 'result'" class="queue-chip">
        <span class="queue-chip-k">queue</span>
        <span class="queue-chip-v">session {{ position }} / {{ total }}</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="state === 'loading'" class="empty-line">loading_</div>

    <!-- Gate: not a cloud + verified account -->
    <div v-else-if="state === 'gate'" class="panel-card panel-card--faint gate-card">
      <div class="card-eyebrow card-eyebrow--faint">⃠ confirmed_account_required</div>
      <h2 class="card-title">Sign in to review.</h2>
      <p class="card-body">
        Judging others is for confirmed operators only — it's what keeps crowd-scores
        honest. Sign in or sign up from the menu and verify your email, then this queue
        opens up.
      </p>
    </div>

    <!-- Queue clear -->
    <div v-else-if="state === 'empty'" class="panel-card panel-card--dashed empty-card">
      <div class="empty-card-title">queue_clear</div>
      <p class="empty-card-body">
        No sessions awaiting your judgment right now. The server assigns new ones as
        operators release sessions into the pool. Check back later.
      </p>
    </div>

    <!-- Intro -->
    <div v-else-if="state === 'intro'" class="panel-card panel-card--signal intro-card">
      <div class="card-eyebrow card-eyebrow--signal">▣ {{ count }} session{{ count === 1 ? '' : 's' }} awaiting your judgment</div>
      <h2 class="card-title">Ready to review.</h2>
      <p class="card-body">
        You're judging someone else's session. Carefully review their session notes and
        sketches and rank the images accordingly.
      </p>
      <button class="btn btn--signal" :disabled="loadingNext" @click="beginReview">
        {{ loadingNext ? 'loading_' : 'begin_review →' }}
      </button>
    </div>

    <!-- Result -->
    <div v-else-if="state === 'result'" class="panel-card result-card" :class="result.hit ? 'panel-card--hit' : 'panel-card--neutral'">
      <div class="card-eyebrow" :class="result.hit ? 'card-eyebrow--hit' : 'card-eyebrow--faint'">✓ ranking_recorded</div>
      <h2 class="card-title">{{ result.hit ? 'You read it correctly.' : 'Not this time.' }}</h2>
      <p class="card-body">Your vote has been added to this session's crowd-score.</p>

      <!-- Modest reveal: which candidate was the true target + how you ranked it -->
      <div class="reveal-block">
        <div class="reveal-thumb" :class="{ 'reveal-thumb--hit': result.hit }">
          <img v-if="result.targetUrl" :src="result.targetUrl" alt="true target" />
          <div v-else class="reveal-thumb-ph">img</div>
        </div>
        <div class="reveal-meta">
          <div class="reveal-label">true_target</div>
          <div class="reveal-name">{{ result.targetLabel }}</div>
          <div class="reveal-rank" :class="result.hit ? 'reveal-rank--hit' : 'reveal-rank--miss'">
            you ranked it #{{ result.targetRank }}
            <span class="reveal-verdict">{{ result.hit ? '· correct read' : '· not the closest match' }}</span>
          </div>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn btn--primary" :disabled="loadingNext" @click="advance">
          {{ hasMore ? 'next_session →' : 'finish →' }}
        </button>
        <NuxtLink to="/leaderboard" class="btn btn--ghost">back to network</NuxtLink>
      </div>
    </div>

    <!-- Ranking -->
    <div v-else-if="state === 'ranking'" class="ranking">
      <div class="ranking-head">
        <h2 class="ranking-title">Rank the four candidates against those impressions.</h2>
        <div class="ranking-scale">
          <span class="scale-chance">chance = 25%</span>
          <span class="scale-weak">4 = weakest</span>
        </div>
      </div>
      <div class="ranking-rule">
        <span class="rule-best">1 = best match</span>
        <span class="rule-line" />
      </div>

      <div class="ranking-body">
        <!-- Recorded impressions -->
        <aside class="impressions panel-card panel-card--signal">
          <div class="card-eyebrow card-eyebrow--signal">recorded_impressions</div>

          <div class="impressions-sketch">
            <div class="impressions-sketch-label">their_sketch</div>
            <SketchCanvas v-if="hasSketch" :model-value="sketch" :locked="true" size="small" />
            <div v-else class="sketch-empty">no sketch recorded</div>
          </div>

          <dl class="impression-lines">
            <div v-if="gestaltText" class="impression-line"><dt>gestalt</dt><dd>{{ gestaltText }}</dd></div>
            <div v-if="colorText" class="impression-line"><dt>color</dt><dd>{{ colorText }}</dd></div>
            <div v-if="textureText" class="impression-line"><dt>texture</dt><dd>{{ textureText }}</dd></div>
            <div v-if="dimensionsText" class="impression-line"><dt>dimensions</dt><dd>{{ dimensionsText }}</dd></div>
            <div v-if="!anyImpression" class="impression-line impression-line--empty"><dd>no written impressions — judge on the sketch</dd></div>
          </dl>
        </aside>

        <!-- Candidates -->
        <div class="candidates">
          <div
            v-for="(c, i) in candidates"
            :key="c.id"
            class="candidate"
            :class="{ 'candidate--ranked': ranks[c.id], 'candidate--top': ranks[c.id] === 1 }"
          >
            <div class="candidate-img">
              <img v-if="c.image_url" :src="c.image_url" :alt="candidateLabel(i)" loading="lazy" />
              <span class="candidate-name">{{ candidateLabel(i) }}</span>
              <span class="candidate-badge" :class="rankBadgeClass(c.id)">
                {{ ranks[c.id] ? '#' + ranks[c.id] : 'unranked' }}
              </span>
            </div>
            <div class="candidate-rank">
              <span class="candidate-rank-label">rank</span>
              <button
                v-for="r in [1, 2, 3, 4]"
                :key="r"
                class="rank-btn"
                :class="{ 'rank-btn--top': ranks[c.id] === r && r === 1, 'rank-btn--on': ranks[c.id] === r && r !== 1 }"
                @click="assignRank(c.id, r)"
              >{{ r }}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="ranking-submit">
        <p v-if="submitError" class="submit-error">{{ submitError }}</p>
        <button class="btn" :class="allRanked ? 'btn--primary' : 'btn--idle'" :disabled="!allRanked || submitting" @click="submitRanking">
          {{ submitting ? 'recording_' : (allRanked ? 'submit_ranking →' : 'rank all four to submit') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Stroke } from '~/components/SketchCanvas.vue'

const { apiFetch } = useApi()

interface Candidate { id: string; slot: number; image_url: string | null }
interface ReviewSession {
  session_id: string
  candidates: Candidate[]
  perceptions: { gestalt_tags: string[]; sensory: Record<string, string>; dimensional_tags: string[]; sketch: Stroke[] }
}

type State = 'loading' | 'gate' | 'empty' | 'intro' | 'ranking' | 'result'
const state = ref<State>('loading')

const count = ref(0)
const reviewQueueCount = useState<number>('reviewQueueCount', () => 0)

const sessionId = ref('')
const candidates = ref<Candidate[]>([])
const sketch = ref<Stroke[]>([])
const gestaltTags = ref<string[]>([])
const dimensionalTags = ref<string[]>([])
const sensory = ref<Record<string, string>>({})
const ranks = ref<Record<string, number>>({})

const total = ref(0)      // queue size captured at the start of this review run
const position = ref(1)   // 1-based index within that run
const hasMore = ref(false)
const loadingNext = ref(false)
const submitting = ref(false)
const submitError = ref('')

const result = reactive({
  hit: false,
  targetLabel: '',
  targetRank: 0,
  targetUrl: null as string | null,
})

// ── Impression text ─────────────────────────────────────────────────────────
const hasSketch = computed(() => sketch.value.length > 0)
const gestaltText = computed(() => gestaltTags.value.join(', '))
const colorText = computed(() => sensory.value?.color ?? '')
const textureText = computed(() => sensory.value?.texture ?? '')
const dimensionsText = computed(() => dimensionalTags.value.join(', '))
const anyImpression = computed(() =>
  !!(gestaltText.value || colorText.value || textureText.value || dimensionsText.value))

// ── Ranking ─────────────────────────────────────────────────────────────────
const allRanked = computed(() => {
  const v = Object.values(ranks.value)
  return v.length === 4 && [1, 2, 3, 4].every(r => v.includes(r))
})

function candidateLabel(i: number) {
  return `candidate_${String.fromCharCode(97 + i)}`
}
function rankBadgeClass(id: string) {
  const r = ranks.value[id]
  if (!r) return 'candidate-badge--unranked'
  return r === 1 ? 'candidate-badge--top' : 'candidate-badge--on'
}
function assignRank(id: string, rank: number) {
  for (const [cid, r] of Object.entries(ranks.value)) {
    if (r === rank && cid !== id) delete ranks.value[cid]
  }
  ranks.value[id] = rank
}

function applySession(s: ReviewSession) {
  sessionId.value = s.session_id
  candidates.value = s.candidates
  sketch.value = s.perceptions.sketch ?? []
  gestaltTags.value = s.perceptions.gestalt_tags ?? []
  dimensionalTags.value = s.perceptions.dimensional_tags ?? []
  sensory.value = s.perceptions.sensory ?? {}
  ranks.value = {}
  submitError.value = ''
  state.value = 'ranking'
}

async function beginReview() {
  loadingNext.value = true
  try {
    const data = await apiFetch<{ session: ReviewSession | null; remaining: number }>('/api/review/next')
    if (!data.session) { state.value = 'empty'; return }
    total.value = data.remaining
    position.value = 1
    applySession(data.session)
  }
  catch { state.value = 'empty' }
  finally { loadingNext.value = false }
}

async function submitRanking() {
  submitError.value = ''
  if (!allRanked.value) return
  submitting.value = true
  try {
    const res = await apiFetch<{ hit: boolean; target_candidate_id: string; target_rank: number; remaining: number }>(
      '/api/review/submit',
      { method: 'POST', body: { session_id: sessionId.value, ranking: ranks.value } },
    )
    const idx = candidates.value.findIndex(c => c.id === res.target_candidate_id)
    result.hit = res.hit
    result.targetRank = res.target_rank
    result.targetLabel = idx >= 0 ? candidateLabel(idx) : 'candidate'
    result.targetUrl = idx >= 0 ? candidates.value[idx]!.image_url : null
    hasMore.value = res.remaining > 0
    reviewQueueCount.value = Math.max(0, res.remaining)
    state.value = 'result'
  }
  catch (e: unknown) {
    submitError.value = (e as { data?: { message?: string } }).data?.message ?? 'Submission failed'
  }
  finally { submitting.value = false }
}

async function advance() {
  if (!hasMore.value) { navigateTo('/leaderboard'); return }
  loadingNext.value = true
  try {
    const data = await apiFetch<{ session: ReviewSession | null; remaining: number }>('/api/review/next')
    if (!data.session) { state.value = 'empty'; return }
    position.value += 1
    applySession(data.session)
  }
  catch { state.value = 'empty' }
  finally { loadingNext.value = false }
}

onMounted(async () => {
  try {
    const q = await apiFetch<{ count: number; eligible: boolean }>('/api/review/queue')
    count.value = q.count
    reviewQueueCount.value = q.count
    if (!q.eligible) { state.value = 'gate'; return }
    state.value = q.count > 0 ? 'intro' : 'empty'
  }
  catch {
    state.value = 'gate'
  }
})
</script>

<style scoped>
.review-screen {
  padding: clamp(40px, 6vw, 64px) clamp(22px, 6vw, 72px) clamp(48px, 7vw, 72px);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.review-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 30px;
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

.queue-chip {
  border: 1px solid var(--psy-line-strong);
  border-radius: 2px;
  padding: 7px 12px;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  display: inline-flex;
  gap: 8px;
  white-space: nowrap;
}
.queue-chip-k { color: var(--psy-tan); }
.queue-chip-v { color: var(--psy-text-faint); }

/* ── Cards ───────────────────────────────────────────────────────────────── */
.panel-card {
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  padding: 28px 30px 30px;
  max-width: 560px;
}
.panel-card--signal { border-top: 2px solid var(--psy-signal); }
.panel-card--hit    { border-top: 2px solid var(--psy-hit); }
.panel-card--neutral { border-top: 2px solid var(--psy-line-strong); }
.panel-card--faint  { border-top: 2px solid var(--psy-line-strong); }
.panel-card--dashed { border-style: dashed; text-align: center; }

.card-eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 14px;
}
.card-eyebrow--signal { color: var(--psy-signal); }
.card-eyebrow--hit    { color: var(--psy-hit); }
.card-eyebrow--faint  { color: var(--psy-text-faint); }

.card-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--psy-text-highlighted);
  margin: 0 0 12px;
}

.card-body {
  font-size: 14px;
  line-height: 1.65;
  color: var(--psy-text-muted);
  margin: 0;
  max-width: 46ch;
}

.intro-card .btn { margin-top: 22px; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-block;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  letter-spacing: 0.06em;
  padding: 11px 18px;
  border-radius: 2px;
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition: filter 0.12s, background 0.12s, color 0.12s;
}
.btn:disabled { opacity: 0.55; cursor: default; }
.btn--signal { background: var(--psy-signal); color: #fff; }
.btn--signal:hover:not(:disabled) { filter: brightness(1.08); }
.btn--primary { background: var(--psy-tan); color: var(--psy-bg); font-weight: 600; }
.btn--primary:hover:not(:disabled) { filter: brightness(1.06); }
.btn--ghost { background: transparent; border-color: var(--psy-line-strong); color: var(--psy-text-muted); }
.btn--ghost:hover { color: var(--psy-text); }
.btn--idle { background: transparent; border-color: var(--psy-line-strong); color: var(--psy-text-faint); }

/* ── Gate / empty ────────────────────────────────────────────────────────── */
.empty-card { max-width: 520px; padding: 34px 30px; }
.empty-card-title {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 12px;
}
.empty-card-body {
  font-size: 14px;
  line-height: 1.65;
  color: var(--psy-text-muted);
  margin: 0 auto;
  max-width: 44ch;
}
.empty-line { font-family: var(--psy-font-mono); color: var(--psy-text-faint); padding: 40px 0; }

/* ── Result reveal ───────────────────────────────────────────────────────── */
.result-card { max-width: 560px; }
.reveal-block {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 22px;
  padding: 16px;
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: 2px;
}
.reveal-thumb {
  width: 92px;
  height: 92px;
  flex-shrink: 0;
  border: 1px solid var(--psy-line-strong);
  background: var(--psy-bg-panel);
  overflow: hidden;
}
.reveal-thumb--hit { border-color: var(--psy-hit); }
.reveal-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.reveal-thumb-ph {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--psy-font-mono); font-size: 11px; color: var(--psy-text-faint);
}
.reveal-meta { min-width: 0; }
.reveal-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
}
.reveal-name {
  font-family: var(--psy-font-mono);
  font-size: 16px;
  color: var(--psy-text-highlighted);
  margin: 3px 0 8px;
}
.reveal-rank {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}
.reveal-rank--hit { color: var(--psy-hit); }
.reveal-rank--miss { color: var(--psy-text-muted); }
.reveal-verdict { color: var(--psy-text-faint); }

.result-actions { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }

/* ── Ranking ─────────────────────────────────────────────────────────────── */
.ranking-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}
.ranking-title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--psy-text-highlighted);
  margin: 0;
  max-width: 40ch;
}
.ranking-scale {
  text-align: right;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  line-height: 1.7;
  white-space: nowrap;
}
.scale-chance { display: block; color: var(--psy-text-faint); }
.scale-weak { display: block; color: var(--psy-text-faint); }

.ranking-rule {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 0 26px;
}
.rule-best {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--psy-signal);
  white-space: nowrap;
}
.rule-line { flex: 1; height: 1px; background: var(--psy-line); }

.ranking-body {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 26px;
  align-items: start;
}

.impressions { padding: 20px; position: sticky; top: 24px; max-width: none; }
.impressions-sketch { margin: 8px 0 16px; }
.impressions-sketch-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 8px;
}
.sketch-empty {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  color: var(--psy-text-faint);
  padding: 22px 0;
  text-align: center;
  border: 1px dashed var(--psy-line);
}

.impression-lines { margin: 0; display: flex; flex-direction: column; gap: 9px; }
.impression-line {
  display: flex;
  gap: 8px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
}
.impression-line dt { color: var(--psy-text-faint); margin: 0; }
.impression-line dt::after { content: " ·"; }
.impression-line dd { color: var(--psy-text); margin: 0; }
.impression-line--empty dd { color: var(--psy-text-faint); font-size: 12px; }

/* ── Candidate cards ─────────────────────────────────────────────────────── */
.candidates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.candidate {
  border: 1px solid var(--psy-line);
  background: var(--psy-bg-base);
  border-radius: 2px;
  overflow: hidden;
  transition: border-color 0.14s, box-shadow 0.14s;
}
.candidate--ranked { border-color: var(--psy-line-strong); }
.candidate--top { border-color: var(--psy-signal); box-shadow: inset 0 0 0 1px var(--psy-signal); }

.candidate-img {
  position: relative;
  aspect-ratio: 16 / 7;
  background: var(--psy-bg-inset);
  background-image: repeating-linear-gradient(135deg, var(--psy-bg-panel) 0 9px, transparent 9px 18px);
  overflow: hidden;
}
.candidate-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.candidate-name {
  position: absolute;
  top: 8px; left: 10px;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--psy-text-faint);
  background: color-mix(in srgb, var(--psy-bg) 55%, transparent);
  padding: 1px 5px;
}
.candidate-badge {
  position: absolute;
  top: 8px; right: 10px;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 2px;
}
.candidate-badge--unranked { color: var(--psy-text-faint); background: color-mix(in srgb, var(--psy-bg) 55%, transparent); }
.candidate-badge--top { color: #fff; background: var(--psy-signal); font-weight: 600; }
.candidate-badge--on  { color: var(--psy-bg); background: var(--psy-tan); font-weight: 600; }

.candidate-rank {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  border-top: 1px solid var(--psy-line);
}
.candidate-rank-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-right: 2px;
}
.rank-btn {
  width: 34px;
  height: 30px;
  font-family: var(--psy-font-mono);
  font-size: 12px;
  border: 1px solid var(--psy-line-strong);
  background: transparent;
  color: var(--psy-text-muted);
  border-radius: 2px;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.rank-btn:hover { border-color: var(--psy-tan); color: var(--psy-text); }
.rank-btn--top { background: var(--psy-signal); border-color: var(--psy-signal); color: #fff; }
.rank-btn--on  { background: var(--psy-tan); border-color: var(--psy-tan); color: var(--psy-bg); }

.ranking-submit {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  margin-top: 26px;
}
.submit-error { color: var(--psy-locked-fg); font-size: 13px; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 880px) {
  .ranking-body { grid-template-columns: 1fr; gap: 18px; }
  .impressions { position: static; }
}
@media (max-width: 560px) {
  .candidates { grid-template-columns: 1fr; }
  .candidate-img { aspect-ratio: 16 / 9; }
  .ranking-head { flex-direction: column; }
  .ranking-scale { text-align: left; }
  .ranking-submit { align-items: stretch; }
  .ranking-submit .btn { text-align: center; }
  .reveal-block { flex-direction: column; align-items: flex-start; }
  .result-actions .btn { flex: 1; text-align: center; }
}
</style>
