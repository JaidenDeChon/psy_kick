<template>
  <div>
    <!-- CRV overview — intro lede, not a card (dialog only) -->
    <div v-if="intro" class="steps-intro">
      <div class="steps-intro-title">Controlled Remote Viewing</div>
      <div class="step-desc">
        <p>
          CRV, or Controlled Remote Viewing, is a Remote Viewing protocol created primarily by
          the artist Ingo Swann. Swann worked with physicists Harold Puthoff and Russell Targ to
          perfect the technique at the Stanford Research Institute (SRI) in the 1970s.
        </p>
        <p>
          CRV works using a few simple steps. The process should take about 5–8 minutes.
        </p>
      </div>
    </div>

    <div class="steps" :class="`steps--${layout}`">
      <!-- 01 -->
      <div class="step-card">
        <div class="step-num">01</div>
        <div class="step-name">clear your mind</div>
        <div class="step-desc">
          <p>First, clear your mind. You should ideally have a calm, non-distracting environment for this.</p>
        </div>
      </div>

      <!-- 02 -->
      <div class="step-card">
        <div class="step-num">02</div>
        <div class="step-name">draw an ideogram</div>
        <div class="step-desc">
          <p>
            Draw an ideogram. This is just a scribble you draw as you begin to tune in — don't think
            about it. Literally, just draw a random scribble however it comes to you spontaneously.
            This part isn't something you can get wrong, so don't overthink it! It should only take a
            second or less to draw the ideogram. It represents a "handshake" of sorts with your target.
            The idea is that this allows your nervous system to capture the foundational energy and
            basic properties of the target.
          </p>
        </div>
      </div>

      <!-- 03 -->
      <div class="step-card">
        <div class="step-num step-num--signal">03</div>
        <div class="step-name">begin capturing</div>
        <div class="step-desc">
          <p>
            Begin capturing! Jot down any signal you get. As an example, you might feel like you sense
            a visual that resembles cobblestone. You might be suddenly reminded of the feeling of a cool
            breeze. You might get a sense that you're viewing an area that feels boxed-in. If your target
            were a medieval market on a busy day, surrounded by buildings on all sides, all of those
            details could be the motifs that you perceive. Write down any signal that comes through.
          </p>
          <p>
            Remember! It's important not to try and guess what the target is. In the example above, you
            wouldn't want to guess that you're viewing a medieval market — you'd want to just hold onto
            the individual perceptions you get. The visual of cobblestone, the feeling of a cool breeze,
            and the sense of being boxed in or surrounded. You want the small details, not a "big picture" guess.
          </p>
          <p>
            If it helps you to write down such a guess in order to clear it from your mind, there will be
            a field for doing so. It will be recorded for you to view later, but won't impact your score.
          </p>
        </div>
      </div>

      <!-- 04 -->
      <div class="step-card">
        <div class="step-num">04</div>
        <div class="step-name">lock in</div>
        <div class="step-desc">
          <p>Lock in your notes and drawings. After you complete your viewing, everything becomes read-only to prevent cheating.</p>
        </div>
      </div>

      <!-- 05 -->
      <div class="step-card">
        <div class="step-num">05</div>
        <div class="step-name">judge vs decoys</div>
        <div class="step-desc">
          <p>
            Judge your results against 3 decoys. The image you were viewing, and 3 other random images,
            will be shown on the screen. Rank each one 1–4 in how accurate they are, with #1 being the
            most similar to what you perceived.
          </p>
        </div>
      </div>

      <!-- 06 -->
      <div class="step-card">
        <div class="step-num step-num--signal">06</div>
        <div class="step-name">reveal the target</div>
        <div class="step-desc">
          <p>
            Your target is then revealed. This step is considered to be very important to the process.
            Sessions after which viewers receive their results tend to have higher scores than otherwise.
          </p>
        </div>
      </div>

      <!-- 07 -->
      <div class="step-card">
        <div class="step-num">07</div>
        <div class="step-name">see your results</div>
        <div class="step-desc">
          <p>
            See your results. Your sketch will be shown alongside the image you viewed for easy comparison.
            Underneath, you'll be shown how your score did against chance. You'll see the following values:
          </p>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Shared protocol-step cards — used by the sessions page (grid) and the
// how_this_works dialog (stack). Single source of truth for both.
withDefaults(defineProps<{ layout?: 'grid' | 'stack', intro?: boolean }>(), {
  layout: 'stack',
  intro: false,
})
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
</style>
