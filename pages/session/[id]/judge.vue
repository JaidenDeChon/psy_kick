<template>
  <div class="judge-screen">
    <div class="judge-header">
      <h2 style="font-size: 20px; font-weight: 700">Which best matches your impressions?</h2>
      <p class="label-mono" style="color: var(--psy-text-faint); margin-top: 4px">
        chance = 25% · rank all four · #1 = best match
      </p>
    </div>

    <div class="judge-body">
      <!-- Recorded impressions panel -->
      <div class="impressions-panel psy-panel">
        <p class="label-mono" style="color: var(--psy-text-muted); margin-bottom: 12px">recorded_impressions</p>

        <div v-if="sketch.length > 0" style="margin-bottom: 12px">
          <p class="label-mono" style="margin-bottom: 6px; color: var(--psy-text-faint)">sketch_</p>
          <SketchCanvas :model-value="sketch" :locked="true" size="small" />
        </div>

        <div v-if="gestaltTags.length > 0" style="margin-bottom: 10px">
          <p class="label-mono" style="margin-bottom: 4px; color: var(--psy-text-faint)">gestalt_</p>
          <div class="tag-group">
            <span v-for="tag in gestaltTags" :key="tag" class="tag-chip selected">{{ tag }}</span>
          </div>
        </div>

        <div v-if="colorImpression || textureImpression" class="sensory-row">
          <span v-if="colorImpression" class="sensory-item">
            <span class="label-mono" style="color: var(--psy-text-faint)">color_</span>
            {{ colorImpression }}
          </span>
          <span v-if="textureImpression" class="sensory-item">
            <span class="label-mono" style="color: var(--psy-text-faint)">texture_</span>
            {{ textureImpression }}
          </span>
        </div>

        <div v-if="dimensionalTags.length > 0" style="margin-top: 10px">
          <p class="label-mono" style="margin-bottom: 4px; color: var(--psy-text-faint)">dimensional_</p>
          <div class="tag-group">
            <span v-for="tag in dimensionalTags" :key="tag" class="tag-chip selected">{{ tag }}</span>
          </div>
        </div>
      </div>

      <!-- Candidate images -->
      <div class="candidates-grid">
        <div
          v-for="candidate in candidates"
          :key="candidate.id"
          class="candidate-card"
          :class="{ ranked: ranks[candidate.id] }"
        >
          <div class="candidate-image-wrap">
            <img
              v-if="candidate.image_url"
              :src="candidate.image_url"
              :alt="`Candidate ${candidate.slot}`"
              class="candidate-image"
              loading="lazy"
            />
            <div v-else class="candidate-placeholder label-mono">loading_</div>
          </div>

          <div class="rank-selector">
            <button
              v-for="r in [1, 2, 3, 4]"
              :key="r"
              class="rank-btn"
              :class="{ active: ranks[candidate.id] === r }"
              @click="assignRank(candidate.id, r)"
            >
              #{{ r }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Submit -->
    <div class="submit-row">
      <p v-if="rankError" style="color: var(--psy-locked); font-size: 13px">{{ rankError }}</p>
      <UButton
        size="lg"
        :loading="submitting"
        :disabled="!allRanked || submitting"
        style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
        @click="submitRanking"
      >
        submit_ranking →
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Stroke } from '~/components/SketchCanvas.vue'

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const sessionId = route.params.id as string

interface Candidate {
  id: string
  slot: number
  image_url: string | null
}

const candidates = ref<Candidate[]>([])
const sketch = ref<Stroke[]>([])
const gestaltTags = ref<string[]>([])
const dimensionalTags = ref<string[]>([])
const colorImpression = ref('')
const textureImpression = ref('')
const ranks = ref<Record<string, number>>({})
const submitting = ref(false)
const rankError = ref('')

const allRanked = computed(() => {
  const values = Object.values(ranks.value)
  return (
    values.length === 4 &&
    [1, 2, 3, 4].every((r) => values.includes(r))
  )
})

function assignRank(candidateId: string, rank: number) {
  // Swap: if another candidate already has this rank, unset it
  for (const [id, r] of Object.entries(ranks.value)) {
    if (r === rank && id !== candidateId) {
      delete ranks.value[id]
    }
  }
  ranks.value[candidateId] = rank
}

async function submitRanking() {
  rankError.value = ''
  if (!allRanked.value) {
    rankError.value = 'Rank all 4 candidates before submitting.'
    return
  }

  submitting.value = true
  try {
    await apiFetch(`/api/session/${sessionId}/judge`, {
      method: 'POST',
      body: { ranking: ranks.value },
    })
    router.push(`/session/${sessionId}/result?finished=1`)
  }
  catch (e: unknown) {
    rankError.value = (e as { data?: { message?: string } }).data?.message ?? 'Submission failed'
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    // Load session + impressions
    const session = await apiFetch<{
      reference_number: string
      status: string
      perceptions: {
        sketch: Stroke[]
        gestalt_tags: string[]
        dimensional_tags: string[]
        sensory: Record<string, string>
      }
    }>(`/api/session/${sessionId}`)

    if (session.status === 'judged') { router.replace(`/session/${sessionId}/result`); return }
    if (!['revealed', 'locked'].includes(session.status)) { router.replace('/'); return }

    sketch.value = session.perceptions.sketch ?? []
    gestaltTags.value = session.perceptions.gestalt_tags ?? []
    dimensionalTags.value = session.perceptions.dimensional_tags ?? []
    colorImpression.value = session.perceptions.sensory?.color ?? ''
    textureImpression.value = session.perceptions.sensory?.texture ?? ''

    // Load candidates (signed URLs, no is_target)
    const candData = await apiFetch<{ candidates: Candidate[] }>(`/api/session/${sessionId}/candidates`)
    candidates.value = candData.candidates
  }
  catch {
    router.replace('/')
  }
})
</script>

<style scoped>
.judge-screen {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.judge-header {
  text-align: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--psy-line);
}

.judge-body {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  align-items: start;
}

.impressions-panel {
  position: sticky;
  top: 80px;
}

.sensory-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.sensory-item {
  font-size: 13px;
  color: var(--psy-text-muted);
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  padding: 3px 8px;
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  border: 1px solid var(--psy-line);
  border-radius: 2px;
  background: transparent;
  color: var(--psy-text-muted);
}

.tag-chip.selected {
  border-color: var(--psy-tan);
  color: var(--psy-tan);
}

.candidates-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.candidate-card {
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  overflow: hidden;
  background: var(--psy-bg-panel);
  transition: border-color 0.15s;
}

.candidate-card.ranked {
  border-color: var(--psy-tan);
}

.candidate-image-wrap {
  aspect-ratio: 4/3;
  overflow: hidden;
  background: var(--psy-bg-inset);
}

.candidate-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.candidate-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--psy-text-faint);
  font-size: 11px;
}

.rank-selector {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--psy-line);
}

.rank-btn {
  flex: 1;
  padding: 5px 0;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--psy-line);
  border-radius: 2px;
  background: transparent;
  color: var(--psy-text-muted);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.rank-btn:hover {
  border-color: var(--psy-tan);
  color: var(--psy-text);
}

.rank-btn.active {
  border-color: var(--psy-tan);
  background: rgba(154, 123, 58, 0.12);
  color: var(--psy-tan);
}

.submit-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  border-top: 1px solid var(--psy-line);
  padding-top: 20px;
}

@media (max-width: 640px) {
  .judge-body {
    grid-template-columns: 1fr;
  }
  .candidates-grid {
    grid-template-columns: 1fr 1fr;
  }
  .impressions-panel {
    position: static;
  }
}
</style>
