<template>
  <div class="cooldown-screen">
    <div class="ref-display">
      <span class="label-mono" style="color: var(--psy-text-faint)">target_reference</span>
      <div class="ref-number ref-token psy-glow-text">{{ referenceNumber }}</div>
    </div>

    <!-- Breathing orb -->
    <BreatheLoop />

    <div class="breathe-copy">
      <p style="font-size: 18px; color: var(--psy-text-muted); font-weight: 300; letter-spacing: 0.04em">breathe. settle.</p>
      <p style="font-size: 13px; font-family: var(--psy-font-mono); color: var(--psy-text-faint); margin-top: 8px">clear your mind before capturing impressions</p>
    </div>

    <div class="actions">
      <div class="action-row">
        <UButton
          size="lg"
          color="neutral"
          variant="outline"
          style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
          @click="showHelp = true"
        >
          wait, how do I do this?
        </UButton>
        <UButton
          size="lg"
          variant="outline"
          style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
          @click="enter"
        >
          begin →
        </UButton>
      </div>

      <UButton
        variant="ghost"
        color="neutral"
        :loading="cancelling"
        style="font-family: var(--psy-font-mono); letter-spacing: 0.06em; color: var(--psy-text-faint)"
        @click="cancelSession"
      >
        ✕ cancel_session
      </UButton>
    </div>

    <!-- Explainer dialog -->
    <HowThisWorksDialog v-model:open="showHelp" />
  </div>
</template>

<script setup lang="ts">
import BreatheLoop from '~/components/illustrations/crv/BreatheLoop.vue'

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const sessionId = route.params.id as string
const referenceNumber = ref('')
const showHelp = ref(false)
const cancelling = ref(false)

// Load session to get reference number
onMounted(async () => {
  try {
    const data = await apiFetch<{ reference_number: string; status: string }>(`/api/session/${sessionId}`)
    referenceNumber.value = data.reference_number
    if (data.status === 'revealed') router.replace(`/session/${sessionId}/result`)
    else if (data.status === 'judged') router.replace(`/session/${sessionId}/reveal`)
    else if (data.status === 'locked') router.replace(`/session/${sessionId}/judge`)
  }
  catch {
    router.replace('/')
  }
})

function enter() {
  router.push(`/session/${sessionId}/capture`)
}

// Discard this freshly-created session and return to the protocol picker.
async function cancelSession() {
  if (cancelling.value) return
  cancelling.value = true
  try {
    await apiFetch(`/api/session/${sessionId}/cancel`, { method: 'POST' })
  }
  catch { /* non-fatal — leave regardless */ }
  finally {
    router.push('/sessions')
  }
}
</script>

<style scoped>
.cooldown-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  gap: 48px;
  padding: 40px 24px;
}

.ref-display {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.ref-number {
  font-size: 34px;
  font-weight: 600;
  color: var(--psy-signal);
}

.breathe-copy {
  text-align: center;
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}
</style>
