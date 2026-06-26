<template>
  <DialogShell v-model:open="open" eyebrow="how_scoring_works" title="self vs crowd" width-class="w-[500px]">
    <div class="score-explainer">
      <section>
        <h3 class="label-mono" style="color: var(--psy-tan)">self</h3>
        <p>Your own blind ranking of the four candidates against your recorded perceptions. Your private calibration read — the one most exposed to wishful thinking, which is exactly why the crowd check exists.</p>
      </section>

      <section>
        <h3 class="label-mono" style="color: var(--psy-signal)">crowd</h3>
        <p>The average of independent blind rankings by other viewers, judging the same record — your sketch and notes — with no stake in the answer. It tests whether the signal was actually captured, not merely felt. This is the external check, and the only score that counts toward the leaderboard.</p>
      </section>

      <section>
        <h3 class="label-mono" style="color: var(--psy-text-muted)">-- (pending)</h3>
        <p>A crowd-score stays <span class="mono">--</span> until at least 5 independent viewers have judged the session. Until then there aren't enough reads to mean anything.</p>
      </section>

      <div class="info-footer">
        <p class="label-mono" style="color: var(--psy-text-faint)">both score the same session · chance = 25% (1 of 4)</p>
      </div>
    </div>

    <template #footer>
      <div class="score-foot">
        <UButton variant="ghost" @click="open = false">Close</UButton>
      </div>
    </template>
  </DialogShell>
</template>

<script setup lang="ts">
const open = defineModel<boolean>({ default: false })
</script>

<style scoped>
.score-explainer {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0;
}

section h3 {
  margin-bottom: 6px;
  font-size: 11px;
}

section p {
  font-size: 14px;
  line-height: 1.65;
  color: var(--psy-text-muted);
}

.info-footer {
  padding-top: 12px;
  border-top: 1px solid var(--psy-line);
}

.score-foot {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
