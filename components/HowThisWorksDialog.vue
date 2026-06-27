<template>
  <DialogShell v-model:open="open" eyebrow="get ready to read a lot" title="how_this_works" width-class="w-[680px]">
    <div class="hiw">
      <!-- The animated slide (steps 01–07; the intro has none). Every
           illustration is rendered at once, stacked into a single grid cell, so
           the stage always reserves the tallest one's height — the dialog never
           resizes between slides. Only the current slide's illustration is
           visible (see .hiw-art below). -->
      <div v-if="current.comp" class="hiw-stage">
        <component
          :is="s.comp"
          v-for="s in animatedSlides"
          :key="s.n"
          class="hiw-art"
          :class="{ 'is-active': s.n === current.n }"
        />
      </div>

      <!-- Description, pulled verbatim from the shared ProtocolSteps source and
           rendered `bare`: no card chrome, no step numbers. Every slide's copy is
           stacked into one grid cell (like the stage) so this section keeps a
           constant height too — only the current slide's copy is visible. -->
      <div class="hiw-copy">
        <div
          v-for="s in slides"
          :key="s.n"
          class="hiw-copy-slide"
          :class="{ 'is-active': s.n === current.n }"
        >
          <ProtocolSteps v-if="s.n === 0" intro bare :only="0" />
          <ProtocolSteps v-else-if="s.n === 7" bare :only="7" v-model:details-open="resultsOpen" />
          <ProtocolSteps v-else bare :only="s.n" />
        </div>
      </div>

      <!-- back / next, pinned to the bottom of the dialog body -->
      <div class="hiw-nav">
        <UButton
          size="md"
          color="neutral"
          variant="outline"
          class="hiw-btn"
          :disabled="idx === 0"
          @click="prev"
        >
          ← back
        </UButton>

        <span class="hiw-pos">{{ idx + 1 }} / {{ slides.length }}</span>

        <UButton
          size="md"
          color="neutral"
          variant="outline"
          class="hiw-btn"
          :disabled="idx === slides.length - 1"
          @click="next"
        >
          next →
        </UButton>
      </div>
    </div>

    <template #footer>
      <div class="dialog-foot">
        <UButton
          size="lg"
          color="neutral"
          variant="outline"
          style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
          @click="open = false"
        >
          dismiss
        </UButton>
      </div>
    </template>
  </DialogShell>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Component } from 'vue'
import BreatheLoop from '~/components/illustrations/crv/BreatheLoop.vue'
import IdeogramLoop from '~/components/illustrations/crv/IdeogramLoop.vue'
import CaptureTypingLoop from '~/components/illustrations/crv/CaptureTypingLoop.vue'
import LockInLoop from '~/components/illustrations/crv/LockInLoop.vue'
import JudgeDecoysLoop from '~/components/illustrations/crv/JudgeDecoysLoop.vue'
import RevealTargetLoop from '~/components/illustrations/crv/RevealTargetLoop.vue'
import ResultsLoop from '~/components/illustrations/crv/ResultsLoop.vue'

// The how_this_works explainer — shared by the CRV protocol card (sessions page)
// and the cool-down screen. The body is a one-step-at-a-time walkthrough: each
// step's animated illustration above its description. The description copy is
// pulled straight from <ProtocolSteps> (the single source of truth) via its
// `only` prop, so nothing here restates or forks the step wording.
const open = defineModel<boolean>('open', { default: false })

interface Slide { n: number, comp: Component | null }

// `n` is the ProtocolSteps step number (0 = the CRV intro lede). `comp` is the
// animated illustration, or null for the steps that don't have one (the intro).
// To make this a seven-slide animated-only carousel, drop the one null entry.
const slides: Slide[] = [
  { n: 0, comp: null },              // Controlled Remote Viewing (intro)
  { n: 1, comp: BreatheLoop },       // 01 · clear your mind
  { n: 2, comp: IdeogramLoop },      // 02 · draw an ideogram
  { n: 3, comp: CaptureTypingLoop }, // 03 · begin capturing
  { n: 4, comp: LockInLoop },        // 04 · lock in
  { n: 5, comp: JudgeDecoysLoop },   // 05 · judge vs decoys
  { n: 6, comp: RevealTargetLoop },  // 06 · reveal the target
  { n: 7, comp: ResultsLoop },       // 07 · see your results
]

// Every slide that actually has an illustration. All are rendered together and
// stacked so the stage reserves the tallest one's height (see .hiw-stage).
const animatedSlides = slides.filter(
  (s): s is Slide & { comp: Component } => s.comp !== null,
)

const idx = ref(0)
const current = computed<Slide>(() => slides[idx.value] ?? slides[0]!)

// Open state of step 07's metrics accordion. Reset shut whenever the slide
// changes (and on open) so an expanded panel never inflates the stacked copy and
// the dialog stays a constant height as you navigate.
const resultsOpen = ref(false)

function go(delta: number) {
  idx.value = Math.min(Math.max(idx.value + delta, 0), slides.length - 1)
}
const prev = () => go(-1)
const next = () => go(1)

watch(idx, () => { resultsOpen.value = false })

// Always start from the top each time the dialog opens.
watch(open, (isOpen) => {
  if (isOpen) {
    idx.value = 0
    resultsOpen.value = false
  }
})
</script>

<style scoped>
.hiw {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hiw-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hiw-btn {
  font-family: var(--psy-font-mono);
  letter-spacing: 0.06em;
}

.hiw-pos {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--psy-text-muted);
}

/* All illustrations share one grid cell; the hidden ones stay in layout, so the
   stage height equals the tallest illustration and stays constant across every
   animated slide — no dialog resize. */
.hiw-stage {
  display: grid;
  grid-template-columns: minmax(0, 380px);
  justify-content: center;
  justify-items: center;
  align-items: center;
}

.hiw-art {
  grid-row: 1;
  grid-column: 1;
  width: 100%;
}

.hiw-art:not(.is-active) {
  visibility: hidden;
  pointer-events: none;
}

/* Each slide's copy is stacked in one grid cell so this section keeps a constant
   height across slides — like the stage, the dialog doesn't jump as you navigate.
   The tallest copy (with step 07's accordion collapsed) sets the height. */
.hiw-copy {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.hiw-copy-slide {
  grid-row: 1;
  grid-column: 1;
  min-width: 0;
}

.hiw-copy-slide:not(.is-active) {
  visibility: hidden;
  pointer-events: none;
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
