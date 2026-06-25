<template>
  <div class="capture-screen">
    <!-- Header: reference + stepper -->
    <div class="capture-header">
      <div class="ref-token" style="font-size: 18px; color: var(--psy-signal)">{{ referenceNumber }}</div>
      <div class="stage-stepper">
        <span
          v-for="(stage, i) in stages"
          :key="i"
          class="stage-dot"
          :class="{ active: currentStage === i, done: currentStage > i }"
          :title="stage"
        />
      </div>
    </div>

    <!-- PERCEPTIONS panel -->
    <div class="psy-panel signal-top perceptions-panel">
      <div class="panel-label">
        <span class="label-mono signal-text">perceptions · the_signal</span>
      </div>

      <!-- Stage 1: Ideogram + gestalt -->
      <section class="stage-section">
        <div class="stage-label label-mono">stage_1 · initial_gestalt</div>

        <div class="ideogram-row">
          <div class="field-col">
            <div class="field-label label-mono">ideogram_</div>
            <SketchCanvas v-model="form.ideogram" size="small" :locked="false" />
          </div>

          <div class="field-col">
            <div class="field-label label-mono">gestalt_</div>
            <div class="tag-group">
              <button
                v-for="tag in GESTALT_TAGS"
                :key="tag"
                class="tag-chip"
                :class="{ selected: form.gestalt_tags.includes(tag) }"
                @click="toggleTag(form.gestalt_tags, tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Stage 2: Sensory -->
      <section class="stage-section">
        <div class="stage-label label-mono">stage_2 · sensory_impressions</div>
        <div class="sensory-grid">
          <div v-for="field in SENSORY_FIELDS" :key="field.key" class="sensory-field">
            <label class="field-label label-mono">{{ field.label }}</label>
            <UInput
              v-model="form.sensory[field.key]"
              :placeholder="field.placeholder"
              size="sm"
              variant="outline"
              style="font-size: 13px"
              @input="scheduleSave"
            />
          </div>
        </div>
      </section>

      <!-- Stage 3: Dimensional + sketch -->
      <section class="stage-section">
        <div class="stage-label label-mono">stage_3 · dimensional_&amp;_form</div>

        <div class="field-label label-mono" style="margin-bottom: 8px">dimensional_</div>
        <div class="tag-group" style="margin-bottom: 16px">
          <button
            v-for="tag in DIMENSIONAL_TAGS"
            :key="tag"
            class="tag-chip"
            :class="{ selected: form.dimensional_tags.includes(tag) }"
            @click="toggleTag(form.dimensional_tags, tag)"
          >
            {{ tag }}
          </button>
        </div>

        <div class="field-label label-mono" style="margin-bottom: 8px">sketch_</div>
        <SketchCanvas v-model="form.sketch" size="normal" :locked="false" />
      </section>
    </div>

    <!-- AOL block -->
    <div class="aol-block" style="padding: 12px 16px; border-radius: 4px; margin-top: 12px">
      <div class="label-mono" style="color: var(--psy-text-faint); font-style: italic; margin-bottom: 8px">
        aol_log · set_aside
      </div>
      <p style="font-size: 12px; color: var(--psy-text-faint); font-style: italic; margin-bottom: 8px">
        Dump analytic guesses here to clear them from your mind. They are recorded separately.
      </p>
      <UTextarea
        v-model="aolText"
        placeholder="lighthouse, mountain, machinery…"
        :rows="2"
        style="font-size: 13px; font-style: italic; color: var(--psy-text); resize: none"
        @input="scheduleSave"
      />
    </div>

    <!-- Notes -->
    <div style="margin-top: 12px">
      <div class="field-label label-mono" style="margin-bottom: 6px">notes_</div>
      <UTextarea
        v-model="form.notes"
        placeholder="any other observations…"
        :rows="2"
        style="font-size: 13px; resize: none"
        @input="scheduleSave"
      />
    </div>

    <!-- Lock button -->
    <div class="lock-row">
      <UButton
        size="lg"
        variant="ghost"
        color="neutral"
        :disabled="cancelling"
        style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
        @click="showCancelModal = true"
      >
        ✕ cancel_session
      </UButton>
      <UButton
        size="lg"
        class="lock-btn"
        style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
        @click="showLockModal = true"
      >
        ▩ lock_session
      </UButton>
    </div>

    <!-- Lock confirm modal -->
    <UModal v-model:open="showLockModal" :dismissible="!locking">
      <template #header>
        <div>
          <p class="label-mono" style="color: var(--psy-locked-fg, #E0795F); font-size: 10px; letter-spacing: 0.12em">⚠ irreversible</p>
          <h2 style="font-size: 20px; font-weight: 700; margin-top: 4px; color: var(--psy-text)">Lock this session?</h2>
        </div>
      </template>

      <template #body>
        <div style="padding: 4px 0; display: flex; flex-direction: column; gap: 14px">
          <p style="font-size: 14px; color: var(--psy-text-muted)">
            All drawings and notes become permanently read-only. The target image will be revealed.
          </p>
          <div class="psy-panel" style="padding: 12px">
            <p class="ref-token" style="font-size: 16px; color: var(--psy-signal)">{{ referenceNumber }}</p>
            <p class="label-mono" style="margin-top: 8px; color: var(--psy-text-muted)">
              {{ fieldCount }} fields captured · sketch {{ hasSketch ? 'included' : 'empty' }}
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="modal-footer-btns">
          <UButton variant="ghost" :disabled="locking" @click="showLockModal = false">
            cancel
          </UButton>
          <UButton
            :loading="locking"
            color="error"
            style="font-family: var(--psy-font-mono); letter-spacing: 0.05em"
            @click="lockAndReveal"
          >
            ▩ lock &amp; reveal
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Cancel confirm modal -->
    <UModal v-model:open="showCancelModal" :dismissible="!cancelling">
      <template #header>
        <div>
          <p class="label-mono" style="color: var(--psy-locked-fg, #E0795F); font-size: 10px; letter-spacing: 0.12em">⚠ discards_session</p>
          <h2 style="font-size: 20px; font-weight: 700; margin-top: 4px; color: var(--psy-text)">Cancel this session?</h2>
        </div>
      </template>

      <template #body>
        <p style="font-size: 14px; color: var(--psy-text-muted)">
          This session and everything captured so far will be permanently discarded. The target is never revealed.
        </p>
      </template>

      <template #footer>
        <div class="modal-footer-btns">
          <UButton variant="ghost" :disabled="cancelling" @click="showCancelModal = false">
            keep_going
          </UButton>
          <UButton
            :loading="cancelling"
            color="error"
            style="font-family: var(--psy-font-mono); letter-spacing: 0.05em"
            @click="cancelSession"
          >
            ✕ discard
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Save indicator -->
    <div v-if="saving" class="save-indicator label-mono">saving_</div>
  </div>
</template>

<script setup lang="ts">
import type { Stroke } from '~/components/SketchCanvas.vue'

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const sessionId = route.params.id as string
const referenceNumber = ref('')
const showLockModal = ref(false)
const showCancelModal = ref(false)
const locking = ref(false)
const cancelling = ref(false)
const saving = ref(false)
const currentStage = ref(0)
const stages = ['gestalt', 'sensory', 'form']

const GESTALT_TAGS = ['land', 'water', 'structure', 'motion', 'life', 'energy']
const DIMENSIONAL_TAGS = ['tall', 'short', 'wide', 'narrow', 'open', 'enclosed', 'flat', 'deep', 'curved', 'angular']
const SENSORY_FIELDS = [
  { key: 'color',   label: 'color_',   placeholder: 'what color impression?' },
  { key: 'texture', label: 'texture_', placeholder: 'rough, smooth, soft…' },
  { key: 'temp',    label: 'temp_',    placeholder: 'hot, cold, cool…' },
  { key: 'sound',   label: 'sound_',   placeholder: 'loud, silent, hum…' },
  { key: 'smell',   label: 'smell_',   placeholder: 'any impression…' },
  { key: 'taste',   label: 'taste_',   placeholder: 'any impression…' },
]

const form = reactive({
  gestalt_tags: [] as string[],
  sensory: { color: '', texture: '', temp: '', sound: '', smell: '', taste: '' } as Record<string, string>,
  dimensional_tags: [] as string[],
  ideogram: [] as Stroke[],
  sketch: [] as Stroke[],
  notes: '',
})

const aolText = ref('')

const fieldCount = computed(() => {
  let n = 0
  n += form.gestalt_tags.length > 0 ? 1 : 0
  n += Object.values(form.sensory).filter(Boolean).length
  n += form.dimensional_tags.length > 0 ? 1 : 0
  n += aolText.value.trim() ? 1 : 0
  n += form.notes.trim() ? 1 : 0
  return n
})

const hasSketch = computed(() => form.sketch.length > 0 || form.ideogram.length > 0)

// Update stage indicator based on form progress
watch([() => form.gestalt_tags, () => form.sensory, () => form.dimensional_tags], () => {
  if (form.dimensional_tags.length > 0 || form.sketch.length > 0) currentStage.value = 2
  else if (Object.values(form.sensory).some(Boolean)) currentStage.value = 1
  else if (form.gestalt_tags.length > 0) currentStage.value = 0
}, { deep: true })

// ── Tag toggle ────────────────────────────────────────────────────────────────
function toggleTag(arr: string[], tag: string) {
  const i = arr.indexOf(tag)
  if (i === -1) arr.push(tag)
  else arr.splice(i, 1)
  scheduleSave()
}

// ── Autosave (debounced, only while unlocked) ─────────────────────────────────
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 1500)
}

async function save() {
  saving.value = true
  try {
    await apiFetch(`/api/session/${sessionId}/impressions`, {
      method: 'PATCH',
      body: {
        perceptions: {
          gestalt_tags: form.gestalt_tags,
          sensory: form.sensory,
          dimensional_tags: form.dimensional_tags,
          ideogram: form.ideogram,
          sketch: form.sketch,
        },
        aol: aolText.value.trim()
          ? aolText.value.split('\n').filter(Boolean)
          : [],
        notes: form.notes,
      },
    })
  }
  catch { /* non-fatal */ }
  finally {
    saving.value = false
  }
}

// Watch sketches for autosave
watch([() => form.sketch, () => form.ideogram], scheduleSave, { deep: true })

// ── Lock + reveal ──────────────────────────────────────────────────────────────
async function lockAndReveal() {
  locking.value = true
  try {
    // Final save first
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    await save()

    await apiFetch(`/api/session/${sessionId}/lock`, { method: 'POST' })
    await router.push(`/session/${sessionId}/reveal`)
  }
  catch (e: unknown) {
    const msg = (e as { data?: { message?: string } }).data?.message ?? 'Lock failed'
    alert(msg)
  }
  finally {
    locking.value = false
    showLockModal.value = false
  }
}

// ── Cancel + discard ────────────────────────────────────────────────────────────
async function cancelSession() {
  cancelling.value = true
  try {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    await apiFetch(`/api/session/${sessionId}/cancel`, { method: 'POST' })
    await router.push('/sessions')
  }
  catch (e: unknown) {
    const msg = (e as { data?: { message?: string } }).data?.message ?? 'Cancel failed'
    alert(msg)
  }
  finally {
    cancelling.value = false
    showCancelModal.value = false
  }
}

// ── Warn on refresh / tab close (not SPA navigation) ──────────────────────────
function handleBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))

// ── Load existing session data ─────────────────────────────────────────────────
onMounted(async () => {
  try {
    const data = await apiFetch<{
      reference_number: string
      status: string
      notes: string | null
      perceptions: {
        gestalt_tags: string[]
        sensory: Record<string, string>
        dimensional_tags: string[]
        ideogram: Stroke[]
        sketch: Stroke[]
      }
      aol: string[]
    }>(`/api/session/${sessionId}`)

    referenceNumber.value = data.reference_number

    // Redirect if session has moved on
    if (data.status === 'judged') { router.replace(`/session/${sessionId}/result`); return }
    if (data.status === 'revealed') { router.replace(`/session/${sessionId}/judge`); return }
    if (data.status === 'locked') { router.replace(`/session/${sessionId}/reveal`); return }

    // Restore saved state
    form.gestalt_tags = data.perceptions.gestalt_tags ?? []
    Object.assign(form.sensory, data.perceptions.sensory ?? {})
    form.dimensional_tags = data.perceptions.dimensional_tags ?? []
    form.ideogram = data.perceptions.ideogram ?? []
    form.sketch = data.perceptions.sketch ?? []
    form.notes = data.notes ?? ''
    aolText.value = (data.aol ?? []).join('\n')
  }
  catch {
    router.replace('/')
  }
})
</script>

<style scoped>
.capture-screen {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.capture-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--psy-line);
}

.stage-stepper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--psy-line);
  transition: background 0.2s, box-shadow 0.2s;
}

.stage-dot.active {
  background: var(--psy-signal);
  box-shadow: 0 0 10px var(--psy-signal-glow);
}

.stage-dot.done {
  background: var(--psy-tan);
}

.perceptions-panel {
  margin-top: 0;
}

.panel-label {
  margin-bottom: 20px;
}

.stage-section {
  padding-top: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--psy-line);
}

.stage-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.stage-label {
  font-size: 10px;
  color: var(--psy-text-faint);
  margin-bottom: 12px;
}

.field-label {
  font-size: 10px;
  color: var(--psy-text-muted);
  margin-bottom: 6px;
  display: block;
}

.ideogram-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field-col {
  display: flex;
  flex-direction: column;
}

.sensory-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.sensory-field {
  display: flex;
  flex-direction: column;
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  padding: 4px 10px;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  border: 1px solid var(--psy-line);
  border-radius: 2px;
  background: transparent;
  color: var(--psy-text-muted);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}

.tag-chip:hover {
  border-color: var(--psy-tan);
  color: var(--psy-text);
}

.tag-chip.selected {
  border-color: var(--psy-tan);
  color: var(--psy-tan);
  background: rgba(154, 123, 58, 0.08);
}

.lock-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

/* Give lock button the locked/red treatment without overriding NuxtUI with raw styles */
:deep(.lock-btn) {
  --ui-color-primary-500: var(--psy-locked);
  --ui-color-primary-600: #a83f2a;
  --ui-color-primary-400: var(--psy-locked-fg);
}

.modal-footer-btns {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  width: 100%;
}

.save-indicator {
  position: fixed;
  bottom: 16px;
  right: 16px;
  font-size: 10px;
  color: var(--psy-text-faint);
  animation: psy-blink 1s step-end infinite;
}
</style>
