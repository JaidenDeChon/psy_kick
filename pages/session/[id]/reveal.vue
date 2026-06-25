<template>
  <div class="reveal-screen">
    <!-- Pre-reveal state: reference number flares -->
    <Transition name="ref-exit" @after-leave="showImage = true">
      <div v-if="revealing" class="ref-phase">
        <p class="label-mono" style="color: var(--psy-text-faint); margin-bottom: 12px">signal_resolves</p>
        <div
          class="ref-token ref-flare psy-glow-text"
          :class="{ flaring: flaring }"
          style="font-size: 36px; color: var(--psy-signal)"
        >
          {{ referenceNumber || '——' }}
        </div>
        <p style="font-size: 13px; color: var(--psy-text-faint); margin-top: 16px; font-family: var(--psy-font-mono)">
          // sealed · locked · revealing
        </p>
      </div>
    </Transition>

    <!-- Target image crossfade -->
    <Transition name="image-reveal">
      <div v-if="showImage && targetUrl" class="image-phase">
        <p class="label-mono" style="color: var(--psy-signal); margin-bottom: 16px">target_revealed</p>
        <div class="target-image-wrap psy-glow">
          <img :src="targetUrl" :alt="caption || 'target image'" class="target-image" />
        </div>
        <p v-if="caption" style="font-size: 13px; color: var(--psy-text-muted); margin-top: 12px; font-family: var(--psy-font-mono)">
          {{ caption }}
        </p>
        <div class="reveal-actions">
          <UButton
            size="lg"
            style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
            @click="goJudge"
          >
            judge_session →
          </UButton>
        </div>
      </div>
    </Transition>

    <!-- Error state -->
    <div v-if="error" class="error-state">
      <p style="color: var(--psy-locked)">{{ error }}</p>
      <UButton variant="ghost" @click="doReveal">retry</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const sessionId = route.params.id as string
const referenceNumber = ref('')
const targetUrl = ref('')
const caption = ref('')
const revealing = ref(true)
const showImage = ref(false)
const flaring = ref(false)
const error = ref('')

async function doReveal() {
  error.value = ''
  try {
    const data = await apiFetch<{
      target_url: string
      caption: string | null
      reference_number: string
    }>(`/api/session/${sessionId}/reveal`, { method: 'POST' })

    referenceNumber.value = data.reference_number
    targetUrl.value = data.target_url
    caption.value = data.caption ?? ''

    // Flare animation then crossfade
    setTimeout(() => { flaring.value = true }, 300)
    setTimeout(() => { revealing.value = false }, 1800)
  }
  catch (e: unknown) {
    const msg = (e as { data?: { message?: string } }).data?.message ?? 'Reveal failed'
    error.value = msg
    revealing.value = false
  }
}

function goJudge() {
  router.push(`/session/${sessionId}/judge`)
}

onMounted(async () => {
  // Check if already revealed (allow refresh)
  try {
    const data = await apiFetch<{ reference_number: string; status: string }>(`/api/session/${sessionId}`)
    referenceNumber.value = data.reference_number
    if (data.status === 'judged') { router.replace(`/session/${sessionId}/result`); return }
    if (!['locked', 'revealed'].includes(data.status)) { router.replace('/'); return }
  }
  catch { /* will fail gracefully below */ }

  await doReveal()
})
</script>

<style scoped>
.reveal-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 49px);
  gap: 24px;
  padding: 40px 24px;
  position: relative;
}

.ref-phase {
  text-align: center;
}

.ref-flare {
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.ref-flare.flaring {
  transform: scale(1.15);
  filter: brightness(1.6);
}

.image-phase {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.target-image-wrap {
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid var(--psy-signal);
  max-width: min(500px, 90vw);
}

.target-image {
  display: block;
  width: 100%;
  height: auto;
  max-height: 60vh;
  object-fit: contain;
}

.reveal-actions {
  margin-top: 32px;
}

.error-state {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* Transitions */
.ref-exit-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.ref-exit-leave-to {
  opacity: 0;
  transform: scale(1.3);
}

.image-reveal-enter-active {
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.image-reveal-enter-from {
  opacity: 0;
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .ref-flare.flaring { transform: none; filter: none; }
  .ref-exit-leave-active, .image-reveal-enter-active { transition: opacity 0.3s ease; }
  .image-reveal-enter-from { transform: none; }
}
</style>
