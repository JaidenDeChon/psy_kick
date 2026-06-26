<template>
  <div class="cooldown-screen">
    <div class="ref-display">
      <span class="label-mono" style="color: var(--psy-text-faint)">target_reference</span>
      <div class="ref-number ref-token psy-glow-text">{{ referenceNumber }}</div>
    </div>

    <!-- Breathing orb -->
    <div class="orb-container">
      <div class="orb-ring psy-glow" :style="ring1Style" />
      <div class="orb-ring psy-glow" :style="ring2Style" />
      <div class="orb-core psy-glow" />
    </div>

    <div class="breathe-copy">
      <p style="font-size: 18px; color: var(--psy-text-muted); font-weight: 300; letter-spacing: 0.04em">breathe. settle.</p>
      <p style="font-size: 13px; font-family: var(--psy-font-mono); color: var(--psy-text-faint); margin-top: 8px">clear your mind before capturing impressions</p>
    </div>

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

    <!-- Explainer modal (copy TBD) -->
    <UModal v-model:open="showHelp" title="how this works">
      <template #body>
        <!-- explainer content goes here -->
        <div class="help-body" />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const sessionId = route.params.id as string
const referenceNumber = ref('')
const showHelp = ref(false)

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

const ring1Style = { animation: 'psy-ring 3.5s ease-out infinite' }
const ring2Style = { animation: 'psy-ring 3.5s ease-out infinite 1.75s' }

function enter() {
  router.push(`/session/${sessionId}/capture`)
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

.orb-container {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.orb-core {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--psy-signal-400, #339BFF), var(--psy-signal));
  animation: psy-breath 4.6s ease-in-out infinite;
}

.orb-ring {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--psy-signal);
  opacity: 0;
}

.breathe-copy {
  text-align: center;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}

.help-body {
  min-height: 80px;
}
</style>
