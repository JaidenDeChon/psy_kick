<script setup lang="ts">
/**
 * IdeogramLoop — looping "spontaneous ideogram" illustration.
 *
 * A seeded procedural squiggle is drawn on (signal-hot, cooling to ink the
 * instant it commits), held, swiped away left-to-right, and replaced — forever.
 * The mark is PURELY ABSTRACT: it is never shaped toward a gestalt (that's
 * decoded separately in the capture flow), so this carries no AOL.
 *
 *   • Colours come from --psy tokens, so it themes paper/dark automatically.
 *   • The draw is frame-driven (rAF), so the reveal is genuinely progressive.
 *   • Draw duration scales sub-linearly with stroke length → longer strokes
 *     whip faster (reflexive feel); the pen eases an extra `loopSlowdown` through
 *     loop arclength via a per-segment time profile.
 *   • SSR-safe: the first squiggle is computed deterministically and rendered as
 *     a static frame, so there's no empty flash before hydration and no
 *     hydration mismatch. Motion starts on mount, client-only.
 *   • Honours prefers-reduced-motion: leaves the static first mark, no motion.
 *
 * Usage:  <IdeogramLoop :seed="referenceNumber" />
 * Pass the session reference as `seed` for a stable, per-session mark. Most
 * other props are tuning dials with sensible defaults — see below.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, useId } from 'vue'

type Pt = [number, number]

const props = withDefaults(defineProps<{
  /** Determinism source. Pass the session reference. Keep stable for SSR. */
  seed?: string | number
  /** Draw the faint worksheet guides behind the mark. */
  showGuides?: boolean
  /** Per-step probability of a sharp turn-back / hard angle. */
  sharpProbability?: number
  /** Per-step probability of a loop/arc (capped by `maxLoops` per mark). */
  loopProbability?: number
  /** Maximum loops per ideogram. */
  maxLoops?: number
  /** Loop radius range [min, max] in viewBox units. */
  loopRadius?: [number, number]
  /** Loop turn fraction [min, max]; 1 = full circle, <1 = partial arc. */
  loopTurns?: [number, number]
  /** Draw-duration model: clamp(scale × len^exponent, min, max) in ms. */
  speedExponent?: number
  speedScale?: number
  speedClamp?: [number, number]
  /** Extra time-per-length the pen spends over loop arclength (1.10 = +10%). */
  loopSlowdown?: number
  /** Beat timings, in ms. */
  holdMs?: number
  eraseMs?: number
  gapMs?: number
  /** Pause / resume the loop. */
  paused?: boolean
}>(), {
  seed: 'ideogram',
  showGuides: true,
  sharpProbability: 0.16,
  loopProbability: 0.14,
  maxLoops: 1,
  loopRadius: () => [7, 29] as [number, number],
  loopTurns: () => [0.35, 1.15] as [number, number],
  speedExponent: 0.62,
  speedScale: 21,
  speedClamp: () => [495, 1300] as [number, number],
  loopSlowdown: 1.1,
  holdMs: 680,
  eraseMs: 560,
  gapMs: 260,
  paused: false,
})

const maskId = useId()
const pathEl = ref<SVGPathElement | null>(null)
const wipeEl = ref<SVGRectElement | null>(null)

// ── Geometry bounds (viewBox is 0 0 300 150) ────────────────────────────────
const X0 = 38, X1 = 262, Y0 = 42, Y1 = 130, CX = 150, CY = 86
const WIPE_DX = 340 // translation that carries the mask fully clear of the canvas

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashSeed(s: string | number): number {
  if (typeof s === 'number') return s >>> 0
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const r1 = (v: number) => Math.round(v * 10) / 10

interface Squiggle { pts: Pt[], sharp: boolean[], loop: boolean[] }

/** Heading-based random walk: gentle curves, sharp turn-backs, and at most
 *  `maxLoops` variably-sized partial-or-full loops. Stays on the worksheet via
 *  a soft boundary that steers the pen back toward centre. */
function squiggle(rng: () => number): Squiggle {
  const sharpTh = props.sharpProbability
  const loopTh = props.sharpProbability + props.loopProbability
  const [rMin, rMax] = props.loopRadius
  const [tMin, tMax] = props.loopTurns
  const n = 4 + Math.floor(rng() * 5)
  let x = clamp(50 + rng() * 70, X0, X1)
  let y = clamp(55 + rng() * 50, Y0, Y1)
  let heading = rng() * Math.PI * 2
  let loops = 0
  const pts: Pt[] = [[x, y]]
  const sharp: boolean[] = [false]
  const loop: boolean[] = [false]

  for (let i = 0; i < n; i++) {
    const roll = rng()

    if (roll < sharpTh) {
      // sharp angle / turn-back
      heading += (rng() < 0.5 ? -1 : 1) * (1.7 + rng() * 1.5)
      const L = 22 + rng() * 38
      x = clamp(x + Math.cos(heading) * L, X0, X1)
      y = clamp(y + Math.sin(heading) * L, Y0, Y1)
      pts.push([x, y]); sharp.push(true); loop.push(false)
    }
    else if (roll < loopTh && loops < props.maxLoops) {
      // loop / arc
      loops++
      const r = rMin + rng() * (rMax - rMin)
      const dir = rng() < 0.5 ? 1 : -1
      const turns = tMin + rng() * (tMax - tMin)
      const span = turns * 2 * Math.PI
      const steps = Math.max(3, Math.round(turns * 9))
      const cx = x + Math.cos(heading) * r
      const cy = y + Math.sin(heading) * r
      const a0 = Math.atan2(y - cy, x - cx)
      for (let k = 1; k <= steps; k++) {
        const a = a0 + dir * span * (k / steps)
        x = clamp(cx + Math.cos(a) * r, X0, X1)
        y = clamp(cy + Math.sin(a) * r, Y0, Y1)
        pts.push([x, y]); sharp.push(false); loop.push(true)
      }
      heading = a0 + dir * span + (dir * Math.PI) / 2 // continue along the tangent
    }
    else {
      // gentle curve
      heading += (rng() * 2 - 1) * 1.0
      const L = 26 + rng() * 46
      let ax = x + Math.cos(heading) * L
      let ay = y + Math.sin(heading) * L
      if (ax < X0 + 4 || ax > X1 - 4 || ay < Y0 + 4 || ay > Y1 - 4) {
        heading = Math.atan2(CY - y, CX - x) + (rng() * 2 - 1) * 0.6
        ax = x + Math.cos(heading) * L
        ay = y + Math.sin(heading) * L
      }
      x = clamp(ax, X0, X1); y = clamp(ay, Y0, Y1)
      pts.push([x, y]); sharp.push(false); loop.push(false)
    }
  }

  return { pts, sharp, loop }
}

/** Catmull-Rom through the points, with straight segments at sharp vertices. */
function buildPath(pts: Pt[], sharp: boolean[]): string {
  const first = pts[0]
  if (!first) return ''
  let d = `M ${r1(first[0])} ${r1(first[1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    if (!p1 || !p2) continue
    if (sharp[i + 1]) {
      d += ` L ${r1(p2[0])} ${r1(p2[1])}`
    }
    else {
      const p0 = pts[i - 1] ?? p1
      const p3 = pts[i + 2] ?? p2
      const c1x = p1[0] + (p2[0] - p0[0]) / 6
      const c1y = p1[1] + (p2[1] - p0[1]) / 6
      const c2x = p2[0] - (p3[0] - p1[0]) / 6
      const c2y = p2[1] - (p3[1] - p1[1]) / 6
      d += ` C ${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(p2[0])} ${r1(p2[1])}`
    }
  }
  return d
}

/** Time → arclength warp. Loop arclength costs `loopSlowdown`× time per unit
 *  length, so the pen visibly eases through curls while keeping pace on the
 *  straights. `factor` is how much longer the whole draw takes because of it. */
function buildWarp(pts: Pt[], loop: boolean[]) {
  const n = pts.length
  const G: number[] = [0]
  const W: number[] = [0]
  for (let i = 1; i < n; i++) {
    const cur = pts[i]
    const prev = pts[i - 1]
    if (!cur || !prev) continue
    const g = Math.hypot(cur[0] - prev[0], cur[1] - prev[1])
    const w = loop[i] ? props.loopSlowdown : 1
    G[i] = (G[i - 1] ?? 0) + g
    W[i] = (W[i - 1] ?? 0) + g * w
  }
  const Gt = G[n - 1] || 1
  const Wt = W[n - 1] || 1
  const AF = G.map(v => v / Gt) // arclength fraction at each vertex
  const TF = W.map(v => v / Wt) // time fraction at each vertex
  const map = (p: number): number => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    for (let k = 1; k < n; k++) {
      const tfk = TF[k]
      const tfPrev = TF[k - 1]
      const afk = AF[k]
      const afPrev = AF[k - 1]
      if (tfk === undefined || tfPrev === undefined || afk === undefined || afPrev === undefined) continue
      if (p <= tfk) {
        const dd = tfk - tfPrev
        const t = dd > 1e-6 ? (p - tfPrev) / dd : 0
        return afPrev + t * (afk - afPrev)
      }
    }
    return 1
  }
  return { map, factor: Wt / Gt }
}

const outCubic = (p: number) => 1 - Math.pow(1 - p, 3) // snappy flick
const inOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

// Deterministic first squiggle — rendered server-side as the static frame.
const initialPath = computed(() => {
  const rng = mulberry32(hashSeed(props.seed))
  const sq = squiggle(rng)
  return buildPath(sq.pts, sq.sharp)
})

// ── Animation controller (client-only) ──────────────────────────────────────
let active = false
let raf = 0
let timer: ReturnType<typeof setTimeout> | null = null

function rafTween(dur: number, ease: (p: number) => number, fn: (e: number) => void) {
  return new Promise<void>((resolve) => {
    let start: number | null = null
    const step = (t: number) => {
      if (!active) return resolve()
      if (start === null) start = t
      const p = Math.min(1, (t - start) / dur)
      fn(ease(p))
      if (p < 1 && active) raf = requestAnimationFrame(step)
      else resolve()
    }
    raf = requestAnimationFrame(step)
  })
}
function delay(ms: number) {
  return new Promise<void>((resolve) => { timer = setTimeout(resolve, ms) })
}

async function runLoop() {
  const path = pathEl.value
  const wipe = wipeEl.value
  if (!path || !wipe) return

  active = true
  const rng = mulberry32(hashSeed(props.seed)) // first animated mark == the static one

  while (active) {
    const sq = squiggle(rng)
    path.setAttribute('d', buildPath(sq.pts, sq.sharp))
    const len = path.getTotalLength()
    const warp = buildWarp(sq.pts, sq.loop)
    const [cMin, cMax] = props.speedClamp
    const baseDur = clamp(props.speedScale * Math.pow(len, props.speedExponent), cMin, cMax)
    const drawDur = baseDur * warp.factor

    // Reset to hidden + "hot" (signal + glow), with no transition.
    path.style.transition = 'none'
    path.style.strokeDasharray = String(len)
    path.style.strokeDashoffset = String(len)
    path.style.opacity = '1'
    path.classList.add('is-drawing')
    wipe.style.transform = 'translateX(0px)'
    void path.getBoundingClientRect() // flush the reset before re-enabling transitions

    // Draw on, frame by frame, with the loop slowdown baked into the warp.
    await rafTween(drawDur, outCubic, (e) => {
      path.style.strokeDashoffset = String(len * (1 - warp.map(e)))
    })
    if (!active) break

    // Cool: signal → ink (CSS transition handles the fade).
    path.style.transition = 'stroke .3s linear, filter .35s linear'
    path.classList.remove('is-drawing')
    await delay(props.holdMs)
    if (!active) break

    // Swipe erase, left to right.
    await rafTween(props.eraseMs, inOut, (e) => {
      wipe.style.transform = `translateX(${WIPE_DX * e}px)`
    })
    if (!active) break

    path.style.opacity = '0'
    await delay(props.gapMs)
  }
}

function stop() {
  active = false
  if (raf) cancelAnimationFrame(raf)
  if (timer) clearTimeout(timer)
  raf = 0
  timer = null
}

function start() {
  const path = pathEl.value
  if (!path) return

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    // Leave the static first squiggle fully drawn; no motion.
    path.style.strokeDasharray = 'none'
    path.style.opacity = '1'
    return
  }

  // Hide before first paint to avoid a full-mark flash, then draw on.
  const len = path.getTotalLength()
  path.style.strokeDasharray = String(len)
  path.style.strokeDashoffset = String(len)
  runLoop()
}

onMounted(() => { if (!props.paused) start() })
onBeforeUnmount(stop)
watch(() => props.paused, (p) => { if (p) stop(); else if (!active) start() })
watch(() => props.seed, () => { if (active) { stop(); start() } })
</script>

<template>
  <svg
    class="ideogram"
    viewBox="0 0 300 150"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <defs>
      <mask :id="maskId" maskUnits="userSpaceOnUse" x="-40" y="-40" width="400" height="230">
        <rect ref="wipeEl" x="-40" y="-40" width="400" height="230" fill="#fff" />
      </mask>
    </defs>

    <g v-if="showGuides" class="ideogram-guides" stroke-width="0.5" opacity="0.6">
      <line x1="20" y1="50" x2="280" y2="50" />
      <line x1="20" y1="100" x2="280" y2="100" />
      <line x1="100" y1="20" x2="100" y2="135" />
      <line x1="200" y1="20" x2="200" y2="135" />
    </g>

    <path
      ref="pathEl"
      class="ideogram-stroke"
      :mask="`url(#${maskId})`"
      :d="initialPath"
    />
  </svg>
</template>

<style scoped>
.ideogram {
  display: block;
  width: 100%;
  height: auto;
}

.ideogram-guides {
  stroke: var(--psy-line);
}

.ideogram-stroke {
  fill: none;
  stroke: var(--psy-text);
  stroke-width: var(--ideogram-stroke-width, 3);
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The "live signal" state — only while the pen is actually moving. */
.ideogram-stroke.is-drawing {
  stroke: var(--psy-signal);
  filter: drop-shadow(0 0 5px var(--psy-signal-glow));
}

@media (prefers-reduced-motion: reduce) {
  .ideogram-stroke.is-drawing {
    stroke: var(--psy-text);
    filter: none;
  }
}
</style>