<template>
  <div>
    <!-- CRV overview — intro lede, not a card (dialog only) -->
    <div v-if="showIntro" class="steps-intro">
      <div class="steps-intro-title">Controlled Remote Viewing</div>
      <div class="step-desc">
        <p>
          CRV, or Controlled Remote Viewing, is a Remote Viewing protocol created primarily by
          the artist Ingo Swann. Swann worked with physicists Harold Puthoff and Russell Targ to
          perfect the technique at the Stanford Research Institute (SRI) in the 1970s.
        </p>
        <p>
          CRV works using a few simple steps. The process should take about 5-8 minutes.
        </p>
      </div>
    </div>

    <div v-if="showSteps" class="steps" :class="[`steps--${layout}`, { 'steps--bare': bare }]">
      <!-- 01 -->
      <div v-if="showStep(1)" class="step-card">
        <div class="step-num">01</div>
        <div class="step-name">clear your mind</div>
        <div class="step-desc">
          <p>
            Practicing is best in a quiet room with few distractions. Take some deep breaths and get
            into your happy place. Once you are ready to remote view, we'll select a secret image for
            you to tune your attention to. You can't see it yet, but you will after the session.
          </p>
        </div>
      </div>

      <!-- 02 -->
      <div v-if="showStep(2)" class="step-card">
        <div class="step-num">02</div>
        <div class="step-name">draw an ideogram</div>
        <div class="step-desc">
          <p>
            An ideogram is a random, spontaneous scribble drawn in less than a second. It doesn't
            matter what it looks like, and isn't something you can get wrong. It represents a
            "handshake" with your target. The idea is that this allows your nervous system to capture
            the foundational energy and basic properties of the target.
          </p>
        </div>
      </div>

      <!-- 03 -->
      <div v-if="showStep(3)" class="step-card">
        <div class="step-num step-num--signal">03</div>
        <div class="step-name">begin capturing</div>
        <div class="step-desc">
          <p>
            Jot down any signal you get. You might get a visual of a red brick wall, or a feeling that
            reminds you of the smell of roses, or the sense of being in a wide-open space. Write down
            any sense or signal you pick up on. You can also draw what you're sensing —
            <em>this is highly recommended!</em>
          </p>
        </div>
      </div>

      <!-- 04 -->
      <div v-if="showStep(4)" class="step-card">
        <div class="step-num">04</div>
        <div class="step-name">lock in</div>
        <div class="step-desc">
          <p>Lock in your notes and drawings. After you complete your session, everything becomes read-only to prevent cheating.</p>
        </div>
      </div>

      <!-- 05 -->
      <div v-if="showStep(5)" class="step-card">
        <div class="step-num">05</div>
        <div class="step-name">judge vs decoys</div>
        <div class="step-desc">
          <p>
            Before your target is revealed, you will be shown 4 images. One of them is your target,
            but you still don't know which. Rate each image from 1–4 based on how close they are to
            what you remote viewed, with <em>1 being the closest to your viewing</em> and 4 being the
            furthest.
          </p>
        </div>
      </div>

      <!-- 06 -->
      <div v-if="showStep(6)" class="step-card">
        <div class="step-num step-num--signal">06</div>
        <div class="step-name">reveal the target</div>
        <div class="step-desc">
          <p>
            Your target is finally revealed. <em>This step is considered to be very important to the
            process.</em> Sessions after which viewers receive their scores tend to have higher scores
            than otherwise.
          </p>
        </div>
      </div>

      <!-- 07 -->
      <div v-if="showStep(7)" class="step-card">
        <div class="step-num">07</div>
        <div class="step-name">see your results</div>
        <div class="step-desc">
          <p>
            See your results. Your sketch will be shown alongside the image you viewed for easy
            comparison. Underneath, you'll be shown how your score did against chance.
          </p>
        </div>

        <details
          class="step-accordion"
          :open="detailsOpen"
          @toggle="detailsOpen = ($event.target as HTMLDetailsElement).open"
        >
          <summary class="step-accordion-summary">
            what the numbers mean
            <span class="step-accordion-mark" aria-hidden="true" />
          </summary>
          <div class="step-desc step-accordion-body">
            <p>
              <span class="step-term">Hit rate:</span> How often you've ranked the true target as #1 out of 4
              candidates. A "hit" is selecting the correct target out of the 4 candidates. This is what helps
              separate your scores from basic probability over time. Represented as a line on a chart which
              shows accuracy over time.
            </p>
            <p>
              <span class="step-term">Confidence interval:</span> Represented as a shaded band around your hit
              rate line. It narrows as you run more sessions. In the beginning, a single session can cause your
              hit rate to fluctuate wildly, so more tests will help dial in the confidence interval and show you
              your true patterns.
            </p>
            <p>
              <span class="step-term">P-value:</span> The probability that pure luck could do
              <em>at least as well</em> as you did. If remote viewing comes easily to you, this value will
              shrink over time, as chance becomes increasingly unlikely to explain your hits.
            </p>
            <p>
              A viewer who consistently hits will gravitate toward a P-value of 0, while one who consistently
              "hits" will gravitate toward 1. Like the other metrics, this becomes more useful over time as you
              get more sessions under your belt.
            </p>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Shared protocol-step cards — used by the sessions page (grid) and the
// how_this_works dialog (stack). Single source of truth for both.
//
// `only` lets a consumer render a single step (1–7) or just the intro (0) —
// used by the how_this_works slideshow to show one step at a time. When `only`
// is omitted (the sessions grid), every step renders as before.
//
// `bare` drops the card chrome (border/background/padding) and the step number,
// leaving just the name + description as flowing copy — used inside the
// how_this_works dialog. The sessions grid keeps the cards.
const props = withDefaults(defineProps<{
  layout?: 'grid' | 'stack'
  intro?: boolean
  only?: number
  bare?: boolean
}>(), {
  layout: 'stack',
  intro: false,
  bare: false,
})

// Open state of step 07's "what the numbers mean" accordion. Controllable so the
// how_this_works dialog can reset it shut when you navigate away from the slide
// (otherwise an open panel on a hidden slide would inflate the stacked copy and
// the dialog would no longer be a constant height). Unbound consumers (the
// sessions grid) just use it as a local toggle.
const detailsOpen = defineModel<boolean>('detailsOpen', { default: false })

const showIntro = computed(() => props.intro && (props.only === undefined || props.only === 0))
const showSteps = computed(() => props.only === undefined || props.only >= 1)
const showStep = (n: number) => props.only === undefined || props.only === n
</script>

<style scoped>
/* ── Intro lede (dialog only) ─────────────────────────────────────────────── */
.steps-intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.steps-intro-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--psy-text);
}

/* ── Layouts ──────────────────────────────────────────────────────────────── */
.steps--stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Scales fluidly and wraps, capping at 4 columns side-by-side */
.steps--grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(max(220px, (100% - 3 * 14px) / 4), 1fr));
}

/* ── Bare (how_this_works dialog) ─────────────────────────────────────────── */
/* No card chrome, no step number — just the name + description as flowing copy. */
.steps--bare {
  gap: 0;
}

.steps--bare .step-card {
  background: none;
  border: none;
  padding: 0;
}

.steps--bare .step-num {
  display: none;
}

/* ── Card (the dialog card design, shared everywhere) ─────────────────────── */
.step-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  padding: 18px 16px;
}

.step-num {
  font-family: var(--psy-font-mono);
  font-size: 11px;
  color: var(--psy-text-muted);
}

/* Blue accent reserved for the "magic" steps (capture + reveal) */
.step-num--signal { color: var(--psy-signal); }

.step-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--psy-text);
}

.step-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--psy-text-muted);
}

.step-desc p { margin: 0; }
.step-desc p + p { margin-top: 10px; }

.step-term {
  font-weight: 700;
  color: var(--psy-tan);
}

/* ── Step 07 accordion ("what the numbers mean") ──────────────────────────── */
.step-accordion {
  border: 1px solid var(--psy-line);
  border-radius: 3px;
  background: var(--psy-bg-base);
}

.step-accordion-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  list-style: none;
  cursor: pointer;
  user-select: none;
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--psy-text-muted);
  transition: color 0.15s ease;
}

.step-accordion-summary::-webkit-details-marker { display: none; }
.step-accordion-summary:hover { color: var(--psy-text); }

.step-accordion-mark {
  flex-shrink: 0;
  font-family: var(--psy-font-mono);
  color: var(--psy-text-faint);
}

.step-accordion-mark::after { content: '+'; }
.step-accordion[open] .step-accordion-mark::after { content: '−'; }

.step-accordion-body {
  padding: 0 12px 12px;
}
</style>
