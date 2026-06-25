<template>
  <section class="protocol-screen">
    <div class="screen-eyebrow">// new_session</div>
    <h1 class="screen-title">Choose a protocol.</h1>
    <p class="screen-lede">
      Each protocol is a different discipline of remote viewing practice. This app is early in
      development and only offers <span class="tan">Controlled Remote Viewing</span> (CRV), but
      other methodologies are planned for the future.
    </p>

    <!-- Resume banner — only when an in-progress session exists -->
    <div v-if="activeSession" class="resume-banner">
      <div class="resume-meta">
        <span class="resume-label">active_session</span>
        <span class="resume-ref">{{ activeSession.reference_number }}</span>
      </div>
      <div class="resume-actions">
        <button class="cancel-button" :disabled="cancelling" @click="cancelSession">
          {{ cancelling ? 'cancelling…' : 'cancel_session' }}
        </button>
        <button class="resume-button" @click="router.push(resumeUrl)">resume_session →</button>
      </div>
    </div>

    <!-- Protocol cards -->
    <div class="protocol-grid">
      <!-- CRV — active -->
      <div class="protocol-card protocol-card--active">
        <div class="card-top">
          <div class="card-code card-code--tan">CRV</div>
          <span class="card-chip card-chip--ready">ready</span>
        </div>
        <div class="card-name">controlled<br>remote viewing</div>
        <p class="card-desc">
          Relax yourself with some deep breaths, and then tune your awareness into the secret
          image. Write down or draw any visuals, textures, and other motifs you pick up on. When
          finished, you will score your own result.
        </p>
        <div class="card-meta">7-stage blind loop · ~8 min</div>
        <button class="card-begin" :disabled="loading" @click="beginCRV">
          {{ loading ? 'sealing target…' : 'begin viewing subject →' }}
        </button>
        <p v-if="errorMsg" class="card-error">{{ errorMsg }}</p>
      </div>

      <!-- ERV — locked -->
      <div class="protocol-card protocol-card--locked">
        <div class="card-top">
          <div class="card-code">ERV</div>
          <span class="card-chip card-chip--soon">coming_soon</span>
        </div>
        <div class="card-name card-name--muted">extended<br>remote viewing</div>
        <p class="card-desc card-desc--faint">
          A long-form, low-arousal protocol — perception gathered in a near-sleep state
          rather than staged on the page.
        </p>
        <div class="card-meta">on the bench</div>
        <div class="card-locked">▢ locked</div>
      </div>

      <!-- ARV — locked -->
      <div class="protocol-card protocol-card--locked">
        <div class="card-top">
          <div class="card-code">ARV</div>
          <span class="card-chip card-chip--soon">coming_soon</span>
        </div>
        <div class="card-name card-name--muted">associative<br>remote viewing</div>
        <p class="card-desc card-desc--faint">
          Perception bound to a future outcome through a decoy image pair — the protocol
          behind prediction tasks.
        </p>
        <div class="card-meta">on the bench</div>
        <div class="card-locked">▢ locked</div>
      </div>
    </div>

    <!-- The loop -->
    <div class="loop-section">
      <div class="loop-header">
        <div class="loop-label">// what_to_expect</div>
      </div>
      <div class="loop-track">
        <div v-for="stage in loopStages" :key="stage.n" class="loop-card">
          <div class="loop-num" :class="`loop-num--${stage.tone}`">
            {{ stage.n }}
          </div>
          <div class="loop-name">{{ stage.label }}</div>
          <div class="loop-desc">{{ stage.desc }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const router = useRouter()
const { apiFetch } = useApi()

const loading = ref(false)
const cancelling = ref(false)
const errorMsg = ref('')
const activeSession = ref<{ id: string; status: string; reference_number: string } | null>(null)

const loopStages = [
  { n: '01', label: 'ready',   desc: 'calm entry · server picks a secret target', tone: 'faint'  },
  { n: '02', label: 'prepare', desc: 'calm down · prepare to view',                tone: 'signal' },
  { n: '03', label: 'capture', desc: 'record impressions, set guesses aside',      tone: 'faint'  },
  { n: '04', label: 'lock',    desc: 'lock in your notes, drawings',               tone: 'locked' },
  { n: '05', label: 'judge',   desc: 'rank vs 3 decoys',                           tone: 'faint'  },
  { n: '06', label: 'reveal',  desc: 'the payoff · image settles',                 tone: 'signal' },
  { n: '07', label: 'result',  desc: 'score · saved to history',                   tone: 'faint'  },
]

const resumeUrl = computed(() => {
  if (!activeSession.value) return '/sessions'
  const { id, status } = activeSession.value
  if (status === 'revealed') return `/session/${id}/result`
  if (status === 'judged') return `/session/${id}/reveal`
  if (status === 'locked') return `/session/${id}/judge`
  return `/session/${id}/cool-down`
})

// First API call on arrival → lazily creates the Supabase client.
onMounted(async () => {
  try {
    const data = await apiFetch<{
      session: { id: string; status: string; reference_number: string } | null
    }>('/api/session/active')
    if (data.session) activeSession.value = data.session
  }
  catch { /* non-fatal — just hide the resume banner */ }
})

async function beginCRV() {
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await apiFetch<{ session_id: string; reference_number: string }>(
      '/api/session/begin',
      { method: 'POST' },
    )
    await router.push(`/session/${result.session_id}/cool-down`)
  }
  catch (e: unknown) {
    errorMsg.value = (e as { data?: { message?: string } }).data?.message
      ?? 'Failed to start session. Is the local Supabase running?'
  }
  finally {
    loading.value = false
  }
}

async function cancelSession() {
  if (!activeSession.value || cancelling.value) return
  cancelling.value = true
  errorMsg.value = ''
  try {
    await apiFetch(`/api/session/${activeSession.value.id}/cancel`, { method: 'POST' })
    activeSession.value = null
  }
  catch (e: unknown) {
    errorMsg.value = (e as { data?: { message?: string } }).data?.message
      ?? 'Failed to cancel session.'
  }
  finally {
    cancelling.value = false
  }
}
</script>

<style scoped>
.protocol-screen {
  padding: clamp(40px, 6vw, 64px) clamp(22px, 6vw, 72px) clamp(48px, 7vw, 72px);
}

.screen-eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 18px;
}

.screen-title {
  font-size: clamp(34px, 6vw, 46px);
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.02;
  color: var(--psy-text-highlighted);
  margin: 0;
}

.screen-lede {
  margin: 18px 0 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--psy-text-muted);
  max-width: 560px;
}

.tan { color: var(--psy-tan); }

/* ── Resume banner ──────────────────────────────────────────────────────── */
.resume-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 32px;
  padding: 18px 22px;
  background: var(--psy-bg-panel);
  border: 1px solid var(--psy-line);
  border-left: 2px solid var(--psy-signal);
}

.resume-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.resume-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--psy-signal);
}

.resume-ref {
  font-family: var(--psy-font-mono);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--psy-signal);
}

.resume-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.resume-button {
  background: var(--psy-signal);
  color: #fff;
  border: none;
  padding: 12px 20px;
  font-family: var(--psy-font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 2px;
}

.cancel-button {
  background: transparent;
  color: var(--psy-text-faint);
  border: 1px solid var(--psy-line-strong);
  padding: 12px 18px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  border-radius: 2px;
}

.cancel-button:hover:not(:disabled) {
  color: var(--psy-locked);
  border-color: var(--psy-locked);
}

.cancel-button:disabled {
  opacity: 0.6;
  cursor: progress;
}

/* ── Protocol cards ─────────────────────────────────────────────────────── */
.protocol-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  margin-top: 42px;
}

.protocol-card {
  display: flex;
  flex-direction: column;
  padding: 26px 26px 28px;
  border: 1px solid var(--psy-line);
  background: var(--psy-bg-base);
}

.protocol-card--active {
  border: 1px solid var(--psy-line-strong);
  border-top: 2px solid var(--psy-tan);
  background: var(--psy-bg-panel);
}

.protocol-card--locked { opacity: 0.9; }

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-code {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--psy-text-faint);
}

.card-code--tan { color: var(--psy-tan); }

.card-chip {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border-radius: 2px;
}

.card-chip--ready {
  color: var(--psy-hit);
  border: 1px solid var(--psy-hit);
}

.card-chip--soon {
  color: var(--psy-text-faint);
  border: 1px dashed var(--psy-line-strong);
}

.card-name {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--psy-text-highlighted);
  margin-top: 18px;
}

.card-name--muted { color: var(--psy-text-muted); }

.card-desc {
  font-size: 14px;
  line-height: 1.65;
  color: var(--psy-text-muted);
  margin: 14px 0 0;
  flex: 1;
}

.card-desc--faint { color: var(--psy-text-faint); }

.card-meta {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--psy-text-faint);
  margin-top: 20px;
}

.card-begin {
  margin-top: 18px;
  background: var(--psy-tan);
  color: var(--psy-bg);
  border: none;
  padding: 14px;
  font-family: var(--psy-font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 2px;
}

.card-begin:disabled {
  opacity: 0.7;
  cursor: progress;
}

.card-error {
  margin-top: 10px;
  font-size: 12px;
  color: var(--psy-locked);
}

.card-locked {
  margin-top: 18px;
  border: 1px solid var(--psy-line);
  color: var(--psy-text-faint);
  padding: 14px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  text-align: center;
  border-radius: 2px;
}

/* ── The loop ───────────────────────────────────────────────────────────── */
.loop-section { margin-top: 48px; }

.loop-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 24px;
  gap: 12px;
}

.loop-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
}

.loop-track {
  display: flex;
  align-items: stretch;
  gap: 14px;
}

.loop-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  padding: 18px 16px;
}

.loop-num {
  font-family: var(--psy-font-mono);
  font-size: 11px;
}

.loop-num--faint { color: var(--psy-text-faint); }
.loop-num--signal { color: var(--psy-signal); }
.loop-num--locked { color: var(--psy-locked-fg); }

.loop-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--psy-text);
}

.loop-desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--psy-text-faint);
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 860px) {
  .protocol-grid {
    grid-template-columns: 1fr;
  }

  /* keep the 7-stage loop a single scrollable row */
  .loop-track {
    overflow-x: auto;
    padding-bottom: 6px;
    scroll-snap-type: x proximity;
  }

  .loop-card {
    flex: 0 0 auto;
    width: 144px;
    scroll-snap-align: start;
  }
}
</style>
