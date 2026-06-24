<template>
  <UModal v-model:open="open" title="what these mean">
    <template #header>
      <div>
        <p class="label-mono" style="color: var(--psy-signal); font-size: 10px">statistics_explained</p>
        <h2 style="font-size: 18px; font-weight: 700; margin-top: 4px">What these numbers mean</h2>
      </div>
    </template>

    <template #body>
    <div class="stats-explainer">
      <section>
        <h3 class="label-mono" style="color: var(--psy-tan)">hit_rate</h3>
        <p>How often you ranked the true target #1 out of 4 candidates. A completely random guesser would hit 25% of the time — the dashed line shows that baseline.</p>
        <div class="example-block">
          <span class="mono" style="font-size: 13px">3 hits / 12 sessions = 25.0%</span>
          <span class="label-mono" style="margin-left: 8px; color: var(--psy-text-muted)">= chance</span>
        </div>
      </section>

      <section>
        <h3 class="label-mono" style="color: var(--psy-tan)">n (sample size)</h3>
        <p>The number of judged sessions. A small <em>n</em> means your hit rate can fluctuate wildly by luck alone. ~30+ sessions are needed before the number carries any weight.</p>
      </section>

      <section>
        <h3 class="label-mono" style="color: var(--psy-tan)">confidence interval</h3>
        <p>The shaded band around your hit rate (Wilson 95%). At small <em>n</em> the band is wide on purpose — that's the honest picture. As you run more sessions it narrows.</p>
        <div class="example-block mono" style="font-size: 12px; color: var(--psy-text-muted)">
          n=5 → [ 4% – 67% ] &nbsp;·&nbsp; n=50 → [ 14% – 44% ]
        </div>
      </section>

      <section>
        <h3 class="label-mono" style="color: var(--psy-tan)">p-value</h3>
        <p>The probability of getting at least your observed hits by pure luck — if you had no remote-viewing ability at all. A large p-value means luck can easily explain the result. It will stay large at small <em>n</em> — that is correct, not a flaw.</p>
        <div class="example-block mono" style="font-size: 12px; color: var(--psy-text-muted)">
          p = 1.00 at n=5 · still inconclusive. Keep going.
        </div>
      </section>

      <div class="info-footer">
        <p class="label-mono" style="color: var(--psy-text-faint)">25% baseline · 4-candidate rank-order · no vibe-check</p>
      </div>
    </div>
    </template>

    <template #footer>
      <UButton variant="ghost" @click="open = false">Close</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>({ default: false })
</script>

<style scoped>
.stats-explainer {
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

.example-block {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--psy-bg-panel);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
}

.info-footer {
  padding-top: 12px;
  border-top: 1px solid var(--psy-line);
}
</style>
