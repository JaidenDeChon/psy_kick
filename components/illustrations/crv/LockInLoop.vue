<script setup lang="ts">
/**
 * LockInLoop — looping "lock in" illustration.
 *
 * A short form (some fields filled, some empty) with an unlocked padlock; a
 * cursor travels to the lock_session button and clicks; the padlock snaps shut
 * and reddens, the fields drop to a disabled read-only state keeping their
 * content, and the button flips to a spent "locked" state. Then it resets and
 * loops.
 *
 *   • Single instance, themed via --psy tokens (paper / dark automatic).
 *   • The button keeps the paper-mode inversion you approved: dark fill + red
 *     label on paper, red fill + light label in dark. Set `solidButton` to use
 *     a plain locked-red fill in both modes instead.
 *   • SSR-safe: renders the unlocked start state (deterministic, no mismatch);
 *     the cursor + motion start on mount, client-only.
 *   • prefers-reduced-motion: jumps to the locked end-state, no cursor/motion.
 *   • Decorative (aria-hidden) — the instructional copy carries the meaning.
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

interface Field { label: string, value: string }

const props = withDefaults(defineProps<{
  /** Fields shown in the form. Empty `value` renders an empty box. */
  fields?: Field[]
  /** Show the panel chrome (background, border). */
  frame?: boolean
  /** Show the unlocked / locked status word beside the padlock. */
  showStatus?: boolean
  /** Use a plain locked-red button fill in both modes (vs the paper inversion). */
  solidButton?: boolean
  /** Loop forever, or run once and rest on the locked state. */
  loop?: boolean
  buttonLabel?: string
  lockedLabel?: string
  /** Beat timings (ms). */
  startDelayMs?: number
  cursorTravelMs?: number
  holdLockedMs?: number
  /** Pause / resume. */
  paused?: boolean
}>(), {
  fields: () => [
    { label: 'texture_', value: 'rough, grainy' },
    { label: 'temp_', value: 'cool, dry' },
    { label: 'color_', value: '' },
  ],
  frame: true,
  showStatus: true,
  solidButton: false,
  loop: true,
  buttonLabel: '▩ lock_session',
  lockedLabel: '▩ locked',
  startDelayMs: 750,
  cursorTravelMs: 850,
  holdLockedMs: 1900,
  paused: false,
})

const locked = ref(false)
const label = ref(props.buttonLabel)
const btnEl = ref<HTMLElement | null>(null)
const cursorEl = ref<HTMLElement | null>(null)

// ── Animation controller (client-only) ──────────────────────────────────────
let active = false
let timer: ReturnType<typeof setTimeout> | null = null
let pressTimer: ReturnType<typeof setTimeout> | null = null

function delay(ms: number) {
  return new Promise<void>((resolve) => { timer = setTimeout(resolve, ms) })
}

async function runLoop() {
  active = true
  do {
    locked.value = false
    label.value = props.buttonLabel
    const btn = btnEl.value
    const cur = cursorEl.value
    if (!btn || !cur) return
    btn.classList.remove('pressed')
    cur.style.transition = 'none'
    cur.style.transform = ''
    cur.style.opacity = '1'
    await nextTick()
    await delay(props.startDelayMs)
    if (!active) return

    // Travel to the button (tip ≈ 8,5 into the 40px arrow).
    const cr = cur.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    const dx = (br.left + br.width * 0.5) - (cr.left + 8)
    const dy = (br.top + br.height * 0.55) - (cr.top + 5)
    cur.style.transition = `transform ${props.cursorTravelMs}ms cubic-bezier(.4,0,.2,1)`
    cur.style.transform = `translate(${dx}px,${dy}px)`
    await delay(props.cursorTravelMs + 100)
    if (!active) return

    // Click — press + small dip.
    btn.classList.add('pressed')
    cur.style.transition = 'transform .12s ease'
    cur.style.transform = `translate(${dx + 3}px,${dy + 4}px)`
    await delay(150)
    if (!active) return

    // Lock.
    locked.value = true
    label.value = props.lockedLabel
    cur.style.transform = `translate(${dx}px,${dy}px)`
    pressTimer = setTimeout(() => { if (btnEl.value) btnEl.value.classList.remove('pressed') }, 150)
    await delay(props.holdLockedMs)
  } while (active && props.loop)
  active = false
}

function stop() {
  active = false
  if (timer) { clearTimeout(timer); timer = null }
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
}

function start() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    // Static: rest on the locked end-state, no cursor.
    locked.value = true
    label.value = props.lockedLabel
    return
  }
  runLoop()
}

onMounted(() => { if (!props.paused) start() })
onBeforeUnmount(stop)
watch(() => props.paused, (p) => { if (p) stop(); else if (!active) start() })
</script>

<template>
  <div
    class="lock"
    :class="{ 'lock--framed': frame, 'is-locked': locked, 'is-solid': solidButton }"
    aria-hidden="true"
  >
    <div class="lock-top">
      <svg class="lock-glyph" viewBox="0 0 28 30">
        <g class="shackle">
          <path d="M9 13 V9 a5 5 0 0 1 10 0 V13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </g>
        <rect x="5" y="13" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2" />
        <circle cx="14" cy="19.5" r="1.6" fill="currentColor" />
        <rect x="13.2" y="20.5" width="1.6" height="4" rx="0.8" fill="currentColor" />
      </svg>
      <template v-if="showStatus">
        <span class="lock-status st-open">unlocked</span>
        <span class="lock-status st-closed">locked</span>
      </template>
    </div>

    <div v-for="(f, i) in fields" :key="i" class="lock-field">
      <div class="lock-label">{{ f.label }}</div>
      <div class="lock-box"><span class="lock-val">{{ f.value }}</span></div>
    </div>

    <div class="lock-actions">
      <div ref="btnEl" class="lock-btn"><span>{{ label }}</span></div>
      <div ref="cursorEl" class="lock-cursor">
        <svg viewBox="0 0 24 24" width="40" height="40">
          <path class="lock-cursor-arrow" d="M5 3 L5 18 L9.2 14 L12 20.5 L14.4 19.5 L11.6 13.2 L17.5 13.2 Z" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lock {
  position: relative;
  font-family: var(--psy-font-mono);
}

.lock--framed {
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  padding: 12px 16px 16px;
}

.lock-top {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--psy-line);
}

.lock-glyph {
  width: 22px;
  height: 24px;
  color: var(--psy-text-muted);
  transition: color 0.3s ease;
  overflow: visible;
}

.lock.is-locked .lock-glyph {
  color: var(--psy-locked);
  animation: lock-pulse 0.45s ease;
}

@keyframes lock-pulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.18); }
  100% { transform: scale(1); }
}

.shackle {
  transform-box: fill-box;
  transform-origin: right bottom;
  transform: rotate(32deg);
  transition: transform 0.42s cubic-bezier(0.5, 1.5, 0.5, 1);
}

.lock.is-locked .shackle {
  transform: rotate(0deg);
}

.lock-status {
  font-size: 10px;
  letter-spacing: 0.14em;
}

.st-open { color: var(--psy-text-muted); }
.st-closed { color: var(--psy-locked); font-weight: 600; display: none; }
.lock.is-locked .st-open { display: none; }
.lock.is-locked .st-closed { display: inline; }

.lock-field {
  margin-bottom: 12px;
  transition: opacity 0.3s ease;
}

.lock-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--psy-text-muted);
  margin-bottom: 5px;
}

.lock-box {
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
  transition: opacity 0.3s ease, border-color 0.3s ease, background 0.3s ease;
}

.lock-val { color: var(--psy-text); }

.lock.is-locked .lock-field { opacity: 0.5; }
.lock.is-locked .lock-box { border-style: dashed; background: transparent; }

.lock-actions {
  position: relative;
  margin-top: 16px;
  display: flex;
}

/* Paper-mode inversion: dark fill + locked-red label on light, red fill on dark. */
.lock-btn {
  display: inline-block;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 8px 16px;
  border-radius: var(--psy-radius);
  border: 1px solid var(--psy-locked);
  background: var(--ui-bg-inverted);
  color: var(--psy-locked-fg);
  cursor: default;
  user-select: none;
  transition: transform 0.1s ease, filter 0.15s ease, opacity 0.3s ease;
}

:global(.dark) .lock-btn {
  background: var(--psy-locked);
  color: var(--ui-bg-inverted);
}

/* solidButton: plain locked-red fill in both modes. */
.lock.is-solid .lock-btn,
:global(.dark) .lock.is-solid .lock-btn {
  background: var(--psy-locked);
  color: #F6F1E5;
}

.lock-btn.pressed {
  transform: scale(0.96);
  filter: brightness(0.88);
}

.lock.is-locked .lock-btn {
  opacity: 0.45;
}

.lock-cursor {
  position: absolute;
  right: 6px;
  bottom: -10px;
  opacity: 0;
  pointer-events: none;
  transition: transform 0.85s cubic-bezier(0.4, 0, 0.2, 1);
}

.lock-cursor-arrow {
  fill: var(--psy-text);
  stroke: var(--psy-bg-base);
  stroke-width: 1.2;
  stroke-linejoin: round;
}

@media (prefers-reduced-motion: reduce) {
  .lock-cursor { display: none; }
  .shackle, .lock-glyph, .lock-field, .lock-box, .lock-btn {
    transition: none !important;
    animation: none !important;
  }
}
</style>