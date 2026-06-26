<template>
  <section class="protocol-screen">
    <div class="screen-eyebrow">// new_session</div>
    <h1 class="screen-title">Which protocol?</h1>
    <p class="screen-lede">
      Each protocol is a different discipline of remote viewing practice. This app is early in
      development and only offers <span class="tan">Controlled Remote Viewing</span> (CRV), but
      other methodologies are planned for the future.
    </p>

    <!-- Resume list — one banner per in-progress session -->
    <div v-if="activeSessions.length" class="resume-list">
      <div class="resume-list-label">
        active_sessions · {{ activeSessions.length }}
      </div>
      <div v-for="session in activeSessions" :key="session.id" class="resume-banner">
        <div class="resume-meta">
          <span class="resume-label">{{ stageLabel(session.status) }}</span>
          <span class="resume-ref">{{ session.reference_number }}</span>
        </div>
        <div class="resume-actions">
          <button
            class="cancel-button"
            :disabled="cancellingId === session.id"
            @click="cancelSession(session)"
          >
            {{ cancellingId === session.id ? 'cancelling…' : 'cancel_session' }}
          </button>
          <button class="resume-button" @click="router.push(resumeUrl(session))">
            resume_session →
          </button>
        </div>
      </div>
      <p v-if="cancelError" class="card-error">{{ cancelError }}</p>
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
        <div class="card-actions">
          <button class="card-begin" :disabled="loading" @click="beginCRV">
            {{ loading ? 'sealing target…' : 'begin viewing subject →' }}
          </button>
          <button class="card-help" @click="showHelp = true">how does this work?</button>
        </div>
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
        <div class="card-meta">coming soon</div>
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
          Perception bound to a future outcome through a decoy image pair
        </p>
        <div class="card-meta">coming soon</div>
        <div class="card-locked">▢ locked</div>
      </div>
    </div>

    <!-- Protocol explainer — opened from the CRV card's "how does this work?" -->
    <HowThisWorksDialog v-model:open="showHelp" />

    <!-- Guard — only one session of each type may be active at a time -->
    <NewSessionDialog
      v-model:open="showNewSessionWarning"
      :sessions="activeSessions"
      @resume="resumeFromWarning"
      @cancel-restart="cancelAndStartNew"
    />
  </section>
</template>

<script setup lang="ts">
const router = useRouter()
const { apiFetch } = useApi()

interface ActiveSession {
  id: string
  status: string
  reference_number: string
  created_at: string
}

const loading = ref(false)
const cancellingId = ref<string | null>(null)
const errorMsg = ref('')
const cancelError = ref('')
const showHelp = ref(false)
const showNewSessionWarning = ref(false)
const activeSessions = ref<ActiveSession[]>([])

// Where "resume" lands depends on how far the session has progressed.
function resumeUrl(session: ActiveSession) {
  const { id, status } = session
  if (status === 'judged') return `/session/${id}/reveal`
  if (status === 'locked') return `/session/${id}/judge`
  return `/session/${id}/cool-down`
}

// Human-readable stage shown above each session's reference number.
function stageLabel(status: string) {
  if (status === 'judged') return 'ready_to_reveal'
  if (status === 'locked') return 'ready_to_judge'
  return 'capturing'
}

// First API call on arrival → lazily creates the Supabase client.
onMounted(async () => {
  try {
    const data = await apiFetch<{ sessions: ActiveSession[] }>('/api/session/active')
    activeSessions.value = data.sessions ?? []
  }
  catch { /* non-fatal — just hide the resume list */ }
})

// CRV "begin" handler — only one session of this type may be active at a time,
// so if one is already in progress we surface the choice rather than create.
function beginCRV() {
  if (activeSessions.value.length > 0) {
    showNewSessionWarning.value = true
    return
  }
  createSession()
}

// "cancel & start new": discard the in-progress session, then begin a fresh one.
async function cancelAndStartNew() {
  showNewSessionWarning.value = false
  const existing = activeSessions.value[0]
  if (existing) {
    try {
      await apiFetch(`/api/session/${existing.id}/cancel`, { method: 'POST' })
    }
    catch { /* if cancel fails, createSession surfaces the server's rejection */ }
    activeSessions.value = activeSessions.value.filter((s) => s.id !== existing.id)
  }
  createSession()
}

// "resume" from the warning: one in-progress session → jump straight into it;
// several → close the dialog and let them choose from the list on the page.
function resumeFromWarning() {
  showNewSessionWarning.value = false
  if (activeSessions.value.length === 1) {
    router.push(resumeUrl(activeSessions.value[0]!))
  }
}

async function createSession() {
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

async function cancelSession(session: ActiveSession) {
  if (cancellingId.value) return
  cancellingId.value = session.id
  cancelError.value = ''
  try {
    await apiFetch(`/api/session/${session.id}/cancel`, { method: 'POST' })
    activeSessions.value = activeSessions.value.filter((s) => s.id !== session.id)
  }
  catch (e: unknown) {
    cancelError.value = (e as { data?: { message?: string } }).data?.message
      ?? 'Failed to cancel session.'
  }
  finally {
    cancellingId.value = null
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

/* ── Resume list ────────────────────────────────────────────────────────── */
.resume-list {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.resume-list-label {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
}

.resume-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
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

/* begin + how-does-this-work sit side-by-side when the card is wide enough,
   and wrap to a stack when it isn't */
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.card-begin {
  flex: 1 1 0;
  min-width: max-content;
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

.card-help {
  flex: 1 1 0;
  min-width: max-content;
  background: transparent;
  border: 1px solid var(--psy-line-strong);
  border-radius: 2px;
  padding: 14px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--psy-text-muted);
  cursor: pointer;
}

.card-help:hover {
  border-color: var(--psy-tan);
  color: var(--psy-text);
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

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 860px) {
  .protocol-grid {
    grid-template-columns: 1fr;
  }
}
</style>
