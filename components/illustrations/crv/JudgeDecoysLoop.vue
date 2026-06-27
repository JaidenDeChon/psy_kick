<script setup lang="ts">
/**
 * JudgeDecoys — looping "judge vs decoys" illustration.
 *
 * Four stylized single-colour gestalts in a grid; a cursor visits them worst
 * to best, stamping 4 → 3 → 2 → 1, and the #1 pick lights up in signal blue.
 *
 *   • Single instance, themed via --psy tokens. The gestalt art is terracotta
 *     on paper and a warm neutral in dark (both overridable via props).
 *   • Cards are laid out in `candidates` order; the cursor always visits in
 *     descending rank, so the 4→3→2→1 beat (ending on #1) holds regardless of
 *     where #1 sits in the grid.
 *   • Built-in gestalts: beach, car, mug, mountain, bridge, sailboat.
 *   • SSR-safe: renders the un-ranked grid (deterministic); cursor + motion
 *     start on mount, client-only. prefers-reduced-motion: shows the grid fully
 *     ranked with #1 in blue, no cursor.
 *   • Decorative (aria-hidden) — the instructional copy carries the meaning.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

interface Candidate { gestalt: string, rank: number }

const props = withDefaults(defineProps<{
  /** Cards to judge, in grid order. `rank` is the 1–4 stamped on each. */
  candidates?: Candidate[]
  /** Show the panel chrome. */
  frame?: boolean
  /** Loop forever, or run once and rest on the fully-ranked grid. */
  loop?: boolean
  /** Gestalt art colour, per mode. */
  artLight?: string
  artDark?: string
  /** Beat timings (ms). */
  startDelayMs?: number
  travelMs?: number
  clickMs?: number
  gapMs?: number
  holdMs?: number
  /** Pause / resume. */
  paused?: boolean
}>(), {
  candidates: () => ([
    { gestalt: 'beach', rank: 4 },
    { gestalt: 'car', rank: 3 },
    { gestalt: 'mug', rank: 2 },
    { gestalt: 'mountain', rank: 1 },
  ]),
  frame: true,
  loop: true,
  artLight: '#BD6A45',
  artDark: '#C7BB9B',
  startDelayMs: 550,
  travelMs: 600,
  clickMs: 150,
  gapMs: 330,
  holdMs: 1900,
  paused: false,
})

const GESTALTS: Record<string, string> = {
  beach: '<circle cx="76" cy="20" r="8" fill="currentColor" opacity="0.38"/><path d="M2 62 Q50 55 98 62 L98 75 L2 75 Z" fill="currentColor" opacity="0.2"/><g fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M30 63 Q34 45 40 31"/><path d="M40 31 Q26 25 14 30"/><path d="M40 31 Q30 17 20 12"/><path d="M40 31 Q44 15 46 6"/><path d="M40 31 Q54 17 66 14"/><path d="M40 31 Q54 25 66 30"/></g>',
  car: '<path d="M10 50 L16 36 Q19 30 29 30 L48 30 L55 21 Q57 19 61 19 L66 19 Q70 19 72 23 L80 38 L88 42 Q92 43 92 49 L92 54 L10 54 Z" fill="currentColor"/><circle cx="31" cy="55" r="8.5" fill="currentColor"/><circle cx="73" cy="55" r="8.5" fill="currentColor"/>',
  mug: '<path d="M33 26 L63 26 L59 58 Q59 62 55 62 L41 62 Q37 62 37 58 Z" fill="currentColor"/><path d="M63 32 Q80 33 80 44 Q80 55 61 55" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity="0.45"><path d="M44 18 Q40 12 44 5"/><path d="M54 18 Q58 12 54 5"/></g>',
  mountain: '<path d="M12 64 L42 22 L70 64 Z" fill="currentColor" opacity="0.5"/><path d="M36 64 L63 33 L94 64 Z" fill="currentColor"/><path d="M55 45 L63 33 L71 45 L66 43 L63 47 L60 43 Z" fill="currentColor" opacity="0.25"/><rect x="6" y="64" width="88" height="2.5" fill="currentColor" opacity="0.45"/>',
  bridge: '<rect x="8" y="36" width="84" height="5" fill="currentColor"/><path d="M16 58 Q50 30 84 58" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><line x1="16" y1="41" x2="16" y2="58" stroke="currentColor" stroke-width="3"/><line x1="84" y1="41" x2="84" y2="58" stroke="currentColor" stroke-width="3"/><line x1="34" y1="41" x2="34" y2="44" stroke="currentColor" stroke-width="2" opacity="0.6"/><line x1="66" y1="41" x2="66" y2="44" stroke="currentColor" stroke-width="2" opacity="0.6"/><rect x="6" y="60" width="88" height="2.5" fill="currentColor" opacity="0.4"/>',
  sailboat: '<path d="M22 54 L78 54 L70 64 Q68 66 64 66 L36 66 Q32 66 30 64 Z" fill="currentColor"/><line x1="50" y1="16" x2="50" y2="54" stroke="currentColor" stroke-width="3"/><path d="M52 18 L52 50 L78 50 Z" fill="currentColor" opacity="0.85"/><path d="M48 22 L48 50 L30 50 Z" fill="currentColor" opacity="0.5"/><rect x="8" y="66" width="84" height="2.5" fill="currentColor" opacity="0.4"/>',
}

function gestaltMarkup(key: string): string {
  return GESTALTS[key] ?? ''
}

// Visit worst → best so the 4→3→2→1 beat holds wherever #1 sits in the grid.
const visitOrder = computed(() =>
  props.candidates.map((_, i) => i).sort((a, b) => (props.candidates[b]?.rank ?? 0) - (props.candidates[a]?.rank ?? 0)),
)

const assigned = ref<(number | null)[]>(props.candidates.map(() => null))
const topIndex = ref(-1)
const pressIndex = ref(-1)

const rootEl = ref<HTMLElement | null>(null)
const cursorEl = ref<HTMLElement | null>(null)
let cardEls: HTMLElement[] = []

// ── Animation controller (client-only) ──────────────────────────────────────
let active = false
let timer: ReturnType<typeof setTimeout> | null = null
let pressTimer: ReturnType<typeof setTimeout> | null = null

function delay(ms: number) {
  return new Promise<void>((resolve) => { timer = setTimeout(resolve, ms) })
}

async function runLoop() {
  const cur = cursorEl.value
  if (!cur) return
  active = true
  do {
    assigned.value = props.candidates.map(() => null)
    topIndex.value = -1
    pressIndex.value = -1
    cur.style.opacity = '1'
    await nextTick()

    cur.style.transition = 'none'
    cur.style.transform = ''
    void cur.offsetWidth
    const rest = cur.getBoundingClientRect()
    const centers = cardEls.map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })

    await delay(props.startDelayMs)
    if (!active) return

    for (const idx of visitOrder.value) {
      const t = centers[idx]
      const card = props.candidates[idx]
      if (!t || !card) continue

      const dx = t.x - (rest.left + 8)
      const dy = t.y - (rest.top + 5)
      cur.style.transition = `transform ${props.travelMs}ms cubic-bezier(.4,0,.2,1)`
      cur.style.transform = `translate(${dx}px,${dy}px)`
      await delay(props.travelMs + 100)
      if (!active) return

      pressIndex.value = idx
      cur.style.transition = 'transform .12s ease'
      cur.style.transform = `translate(${dx + 3}px,${dy + 4}px)`
      await delay(props.clickMs)
      if (!active) return

      assigned.value[idx] = card.rank
      if (card.rank === 1) topIndex.value = idx
      cur.style.transform = `translate(${dx}px,${dy}px)`
      pressTimer = setTimeout(() => { pressIndex.value = -1 }, 150)
      await delay(props.gapMs)
      if (!active) return
    }

    await delay(props.holdMs)
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
    // Static: show the grid fully ranked, #1 in blue, no cursor.
    assigned.value = props.candidates.map(c => c.rank)
    topIndex.value = props.candidates.findIndex(c => c.rank === 1)
    return
  }
  runLoop()
}

onMounted(() => {
  if (rootEl.value) cardEls = Array.from(rootEl.value.querySelectorAll<HTMLElement>('.judge-cand'))
  if (!props.paused) start()
})
onBeforeUnmount(stop)
watch(() => props.paused, (p) => { if (p) stop(); else if (!active) start() })
</script>

<template>
  <div
    ref="rootEl"
    class="judge"
    :class="{ 'judge--framed': frame }"
    :style="{ '--judge-art-light': artLight, '--judge-art-dark': artDark }"
    aria-hidden="true"
  >
    <div class="judge-grid">
      <div
        v-for="(c, i) in candidates"
        :key="i"
        class="judge-cand"
        :class="{ ranked: assigned[i] != null, top: i === topIndex, press: i === pressIndex }"
      >
        <svg class="judge-art" viewBox="0 0 100 75" v-html="gestaltMarkup(c.gestalt)" />
        <div class="judge-rank">{{ assigned[i] ?? '' }}</div>
      </div>
    </div>

    <div ref="cursorEl" class="judge-cursor">
      <svg viewBox="0 0 24 24" width="40" height="40">
        <path class="judge-cursor-arrow" d="M5 3 L5 18 L9.2 14 L12 20.5 L14.4 19.5 L11.6 13.2 L17.5 13.2 Z" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.judge {
  position: relative;
  font-family: var(--psy-font-mono);
}

.judge--framed {
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  padding: 16px;
}

.judge-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.judge-cand {
  position: relative;
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: 3px;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--judge-art-light);
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.12s ease;
}

:global(.dark) .judge-cand {
  color: var(--judge-art-dark);
}

.judge-cand.press { transform: scale(0.95); }
.judge-cand.ranked { border-color: var(--psy-line-strong); }
.judge-cand.top {
  border-color: var(--psy-signal);
  box-shadow: 0 0 0 1px var(--psy-signal), 0 0 16px var(--psy-signal-glow);
}

.judge-art {
  width: 72%;
  height: 72%;
}

.judge-rank {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 21px;
  height: 21px;
  border-radius: 2px;
  border: 1px dashed var(--psy-line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--psy-text-muted);
  background: var(--psy-bg-base);
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.judge-cand.ranked .judge-rank {
  border-style: solid;
  border-color: var(--psy-line-strong);
  color: var(--psy-text);
}

.judge-cand.top .judge-rank {
  border-style: solid;
  border-color: var(--psy-signal);
  background: var(--psy-signal);
  color: #F6F1E5;
}

.judge-cursor {
  position: absolute;
  right: 4px;
  bottom: -12px;
  pointer-events: none;
  opacity: 0;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.judge-cursor-arrow {
  fill: var(--psy-text);
  stroke: var(--psy-bg-base);
  stroke-width: 1.2;
  stroke-linejoin: round;
}

@media (prefers-reduced-motion: reduce) {
  .judge-cursor { display: none; }
  .judge-cand { transition: none !important; }
}
</style>
