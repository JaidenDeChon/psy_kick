<template>
  <div class="result-screen">
    <div v-if="loading" class="loading label-mono" style="color: var(--psy-text-faint)">loading_</div>

    <template v-else-if="result">
      <!-- Score header -->
      <div class="score-header">
        <div class="ref-token" style="font-size: 18px; color: var(--psy-text-muted)">
          {{ result.reference_number }}
        </div>

        <div class="hit-line">
          <span
            :class="result.hit ? 'hit-badge' : 'miss-badge'"
            style="font-size: 40px; font-weight: 700; font-family: var(--psy-font-mono)"
          >
            {{ result.hit ? 'HIT.' : 'miss.' }}
          </span>
          <span class="label-mono" style="color: var(--psy-text-faint); margin-left: 16px; font-size: 12px">
            ranked #{{ result.target_rank }}/4
          </span>
        </div>
      </div>

      <!-- Side by side: sketch vs target -->
      <div class="comparison-grid">
        <div class="comparison-col">
          <p class="label-mono" style="margin-bottom: 8px; color: var(--psy-text-muted)">your_sketch</p>
          <div class="comparison-panel">
            <SketchCanvas :model-value="result.sketch" :locked="true" />
          </div>
        </div>

        <div class="comparison-col">
          <p class="label-mono" style="margin-bottom: 8px">
            <span style="color: var(--psy-signal)">target_</span>
            <span v-if="result.target_category" style="color: var(--psy-text-faint)">{{ result.target_category }}</span>
          </p>
          <div class="comparison-panel target-panel" :class="{ 'psy-glow': result.hit }">
            <img
              v-if="result.target_url"
              :src="result.target_url"
              :alt="result.target_caption || 'target'"
              class="target-img"
            />
          </div>
          <p v-if="result.target_caption" class="mono" style="font-size: 12px; color: var(--psy-text-muted); margin-top: 6px">
            {{ result.target_caption }}
          </p>
        </div>
      </div>

      <!-- Running stats -->
      <div class="stats-section psy-panel">
        <div class="stats-header">
          <p class="label-mono" style="color: var(--psy-text-muted)">running_stats · vs_chance</p>
          <UButton
            variant="ghost"
            size="xs"
            style="font-family: var(--psy-font-mono); font-size: 11px; color: var(--psy-text-faint)"
            @click="showInfo = true"
          >
            ⓘ what these mean
          </UButton>
        </div>

        <div class="stats-body">
          <div class="stat-big">
            <span
              class="mono"
              style="font-size: 48px; font-weight: 700; line-height: 1"
              :style="{ color: hitRateColor }"
            >
              {{ (result.running_stats.hitRate * 100).toFixed(0) }}%
            </span>
            <span class="label-mono" style="color: var(--psy-text-faint); margin-left: 8px">hit_rate</span>
          </div>

          <div class="stat-details">
            <div class="stat-row">
              <span class="label-mono">n =</span>
              <span class="mono">{{ result.running_stats.n }}</span>
            </div>
            <div class="stat-row">
              <span class="label-mono">baseline =</span>
              <span class="mono" style="color: var(--psy-tan)">25%</span>
            </div>
            <div class="stat-row">
              <span class="label-mono">95% ci =</span>
              <span class="mono" style="color: var(--psy-text-muted)">
                [{{ (result.running_stats.wilsonLower * 100).toFixed(0) }}% –
                {{ (result.running_stats.wilsonUpper * 100).toFixed(0) }}%]
              </span>
            </div>
            <div class="stat-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--psy-line)">
              <span class="label-mono" style="color: var(--psy-text-faint)">p-value =</span>
              <span class="mono" style="color: var(--psy-text-faint); font-size: 12px">
                {{ result.running_stats.pValue.toFixed(3) }}
              </span>
            </div>
          </div>

          <div v-if="result.running_stats.n < 30" class="sample-cue label-mono">
            sample · too_small_to_trust · ~30+ sessions for a confident signal
          </div>
        </div>
      </div>

      <div class="actions-row">
        <UButton
          size="lg"
          variant="outline"
          style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
          @click="saveAndGoHistory"
        >
          save_to_history →
        </UButton>
      </div>
    </template>

    <StatsInfoModal v-model="showInfo" />
  </div>
</template>

<script setup lang="ts">
import type { Stroke } from '~/components/SketchCanvas.vue'
import type { RunningStats } from '~/server/utils/scoring'

interface ResultData {
  hit: boolean
  target_rank: number | null
  reference_number: string
  target_url: string | null
  target_caption: string | null
  target_category: string | null
  sketch: Stroke[]
  gestalt_tags: string[]
  sensory: Record<string, string>
  dimensional_tags: string[]
  running_stats: RunningStats
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const sessionId = route.params.id as string
const result = ref<ResultData | null>(null)
const loading = ref(true)
const showInfo = ref(false)

const hitRateColor = computed(() => {
  if (!result.value) return 'var(--psy-text)'
  const r = result.value.running_stats.hitRate
  if (r > 0.25) return 'var(--psy-hit)'
  if (r < 0.15) return 'var(--psy-miss)'
  return 'var(--psy-text)'
})

function saveAndGoHistory() {
  router.push('/history')
}

onMounted(async () => {
  try {
    const data = await apiFetch<ResultData>(`/api/session/${sessionId}/result`)
    result.value = data
  }
  catch {
    router.replace('/')
  }
  finally {
    loading.value = false
  }
})
</script>

<style scoped>
.result-screen {
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.loading {
  text-align: center;
  padding: 80px;
}

.score-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--psy-line);
}

.hit-line {
  display: flex;
  align-items: baseline;
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.comparison-col {
  display: flex;
  flex-direction: column;
}

.comparison-panel {
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  overflow: hidden;
  background: var(--psy-bg-inset);
  flex: 1;
}

.target-panel {
  border-color: var(--psy-signal);
}

.target-img {
  width: 100%;
  height: 260px;
  object-fit: cover;
  display: block;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stats-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-big {
  display: flex;
  align-items: baseline;
}

.stat-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  align-items: baseline;
}

.stat-row .label-mono {
  font-size: 10px;
  color: var(--psy-text-faint);
  min-width: 80px;
}

.stat-row .mono {
  font-family: var(--psy-font-mono);
  font-size: 13px;
}

.sample-cue {
  font-size: 10px;
  color: var(--psy-text-faint);
  font-style: italic;
  padding: 8px 0;
  border-top: 1px dashed var(--psy-line);
}

.actions-row {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 540px) {
  .comparison-grid { grid-template-columns: 1fr; }
}
</style>
