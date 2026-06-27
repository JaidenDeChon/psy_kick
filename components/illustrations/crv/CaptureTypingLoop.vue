<script setup lang="ts">
/**
 * CaptureTyping — looping "capturing perceptions" illustration.
 *
 * Empty sensory fields focus one at a time; a blinking caret (the psy_kick
 * underscore) appears and a short perception types in character by character;
 * the completed set holds, then the loop restarts. Mirrors the real capture
 * form, and models GOOD capture — small atomic sensory motifs, never a
 * big-picture guess. Beneath the fields a simple house sketch draws on, so the
 * slide shows both halves of a worksheet: the notes and the drawing.
 *
 *   • Single instance, themed via --psy tokens (paper / dark automatic).
 *   • No header text. `frame` toggles the panel chrome + signal line.
 *   • `showSketch` adds the drawn-on house beneath the fields; its strokes are
 *     pathLength-normalised (no measuring) and revealed frame-by-frame.
 *   • SSR-safe: renders empty boxes and a hidden sketch (deterministic, no
 *     hydration mismatch). Motion starts on mount, client-only.
 *   • prefers-reduced-motion: fills straight to the completed form with the
 *     house fully drawn, no motion.
 *   • Decorative (aria-hidden) — the surrounding instructional copy carries the
 *     meaning, so a screen reader isn't fed a looping animation.
 *
 * Timing is guarded against re-entry: only one loop runs at a time, and a
 * generation token makes every await bail the instant the loop is stopped or
 * restarted, so a remount / pause toggle can't leave two loops racing.
 *
 * Usage:  <CaptureTyping />   (defaults to texture_ / temp_ / color_)
 *         <CaptureTyping :fields="[{ label: 'texture_', value: 'rough, grainy' }]" />
 *         <CaptureTyping :show-sketch="false" />
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

interface Field { label: string, value: string }

const props = withDefaults(defineProps<{
  /** Fields to capture, in order. Label is the snake_case micro-label. */
  fields?: Field[]
  /** Show the panel chrome (background, border, 2px signal line). */
  frame?: boolean
  /** Loop forever, or run once and rest on the completed form. */
  loop?: boolean
  /** Dim the inactive fields while one is focused. */
  dimInactive?: boolean
  /** Scale applied to the focused field. */
  activeScale?: number
  /** Show the drawn-on house sketch beneath the fields. */
  showSketch?: boolean
  /** How long the whole house takes to draw (ms). */
  sketchDrawMs?: number
  /** Beat timings (ms). */
  startDelayMs?: number
  focusSettleMs?: number
  charMinMs?: number
  charMaxMs?: number
  fieldHoldMs?: number
  formHoldMs?: number
  /** Pause / resume. */
  paused?: boolean
}>(), {
  fields: () => [
    { label: 'texture_', value: 'rough, grainy' },
    { label: 'temp_', value: 'cool, dry' },
    { label: 'color_', value: 'ochre, pale' },
  ],
  frame: true,
  loop: true,
  dimInactive: true,
  activeScale: 1.04,
  showSketch: true,
  sketchDrawMs: 850,
  startDelayMs: 650,
  focusSettleMs: 300,
  charMinMs: 40,
  charMaxMs: 88,
  fieldHoldMs: 620,
  formHoldMs: 1500,
  paused: false,
})

// Displayed text per field — starts blank (also the SSR frame), so there is no
// placeholder noise and no hydration mismatch.
const display = ref<string[]>(props.fields.map(() => ''))
const activeIndex = ref(-1)

const rootEl = ref<HTMLElement | null>(null)
let sketchPaths: SVGPathElement[] = []

// ── Animation controller (client-only) ──────────────────────────────────────
// `gen` is the generation token: every running loop captures it and bails the
// moment it no longer matches (set by stop / restart). This prevents two loops
// from ever overlapping and fighting over timing.
let active = false
let gen = 0
let rafId: number | null = null
const timers = new Set<ReturnType<typeof setTimeout>>()

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => { timers.delete(t); resolve() }, ms)
    timers.add(t)
  })
}

function clearTimers() {
  timers.forEach(t => clearTimeout(t))
  timers.clear()
}

function setField(i: number, value: string) {
  // Replace the array (not mutate an index) so the render fires every keystroke.
  const next = display.value.slice()
  next[i] = value
  display.value = next
}

function resetSketch() {
  sketchPaths.forEach((p) => { p.style.strokeDashoffset = '100' })
}

function fillSketch() {
  sketchPaths.forEach((p) => { p.style.strokeDashoffset = '0' })
}

// Reveal the strokes in document order, each over its own slice of the timeline.
function drawSketch(myGen: number) {
  return new Promise<void>((resolve) => {
    const paths = sketchPaths
    const n = paths.length
    if (!n) { resolve(); return }
    const start = performance.now()
    const total = props.sketchDrawMs
    const step = (now: number) => {
      if (!active || myGen !== gen) { resolve(); return }
      const t = Math.min((now - start) / total, 1)
      for (let i = 0; i < n; i++) {
        const path = paths[i]
        if (!path) continue
        const a = i / n
        const b = (i + 1) / n
        const local = Math.max(0, Math.min((t - a) / (b - a), 1))
        path.style.strokeDashoffset = String(100 * (1 - local))
      }
      if (t < 1) { rafId = requestAnimationFrame(step) }
      else resolve()
    }
    rafId = requestAnimationFrame(step)
  })
}

async function typeField(i: number, myGen: number) {
  const text = props.fields[i]?.value ?? ''
  for (let c = 1; c <= text.length; c++) {
    if (!active || myGen !== gen) return
    setField(i, text.slice(0, c))
    await delay(props.charMinMs + Math.random() * (props.charMaxMs - props.charMinMs))
  }
}

async function runLoop() {
  if (active) return // never run two loops at once
  active = true
  const myGen = ++gen
  const owns = () => active && myGen === gen

  do {
    display.value = props.fields.map(() => '')
    activeIndex.value = -1
    resetSketch()
    await delay(props.startDelayMs)
    if (!owns()) return

    // Notes first (top), then the sketch draws beneath — reads top to bottom.
    for (let i = 0; i < props.fields.length; i++) {
      activeIndex.value = i
      await delay(props.focusSettleMs)
      if (!owns()) return
      await typeField(i, myGen)
      if (!owns()) return
      await delay(props.fieldHoldMs)
      if (!owns()) return
    }
    activeIndex.value = -1

    if (props.showSketch) {
      await delay(260)
      if (!owns()) return
      await drawSketch(myGen)
      if (!owns()) return
    }

    await delay(props.formHoldMs)
  } while (owns() && props.loop)

  if (myGen === gen) active = false
}

function stop() {
  active = false
  gen++ // invalidate any in-flight loop
  clearTimers()
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

function start() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    // Static: show the completed form and the fully-drawn house, no motion.
    display.value = props.fields.map(f => f.value)
    activeIndex.value = -1
    fillSketch()
    return
  }
  runLoop()
}

onMounted(() => {
  if (rootEl.value) sketchPaths = Array.from(rootEl.value.querySelectorAll<SVGPathElement>('.cap-house path'))
  if (!props.paused) start()
})
onBeforeUnmount(stop)
watch(() => props.paused, (p) => { if (p) stop(); else if (!active) start() })
</script>

<template>
  <div
    ref="rootEl"
    class="cap"
    :class="{ 'cap--framed': frame }"
    :style="{ '--cap-active-scale': activeScale }"
    aria-hidden="true"
  >
    <div class="cap-body">
      <div class="cap-fields">
        <div
          v-for="(f, i) in fields"
          :key="i"
          class="cap-field"
          :class="{
            'is-active': activeIndex === i,
            'is-dim': dimInactive && activeIndex !== -1 && activeIndex !== i,
          }"
        >
          <div class="cap-label">{{ f.label }}</div>
          <div class="cap-box">
            <span class="cap-val">{{ display[i] ?? '' }}</span>
            <span class="cap-caret">_</span>
          </div>
        </div>
      </div>

      <div v-if="showSketch" class="cap-sketch">
        <div class="cap-label">sketch_</div>
        <div class="cap-sketch-box">
          <svg class="cap-house" viewBox="0 0 100 75">
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M16 64 L84 64" opacity=".4" />
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M26 43 L50 24 L74 43" />
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M30 41 L30 64" />
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M30 64 L70 64" />
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M70 64 L70 41" />
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M46 64 L46 52 L56 52 L56 64" />
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M36 47 L44 47 L44 55 L36 55 Z" />
            <path pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="M40 47 L40 55 M36 51 L44 51" opacity=".7" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cap {
  font-family: var(--psy-font-mono);
}

.cap--framed {
  background: var(--psy-bg-panel);
  border: 1px solid var(--psy-line);
  border-top: 2px solid var(--psy-signal);
  border-radius: var(--psy-radius-lg);
  padding: 16px;
}

.cap-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cap-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cap-field {
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform-origin: left center;
}

.cap-field.is-dim {
  opacity: 0.45;
}

.cap-field.is-active {
  transform: scale(var(--cap-active-scale, 1.04));
}

.cap-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--psy-text-muted);
  margin-bottom: 5px;
}

.cap-box {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 5px 9px;
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.cap-field.is-active .cap-box {
  border-color: var(--psy-signal);
  box-shadow: 0 0 0 1px var(--psy-signal), 0 0 12px var(--psy-signal-glow);
}

.cap-val {
  color: var(--psy-text);
}

.cap-caret {
  color: var(--psy-signal);
  opacity: 0;
  font-weight: 600;
  margin-left: 1px;
}

.cap-field.is-active .cap-caret {
  animation: cap-blink 1.05s step-end infinite;
}

@keyframes cap-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.cap-sketch {
  max-width: 160px;
}

.cap-sketch-box {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius);
}

.cap-house {
  width: 84%;
  height: 84%;
  display: block;
}

.cap-house path {
  stroke: var(--psy-text);
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (prefers-reduced-motion: reduce) {
  .cap-field {
    transition: none;
    transform: none;
    opacity: 1;
  }
  .cap-caret {
    display: none;
  }
}
</style>