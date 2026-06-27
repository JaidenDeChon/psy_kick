<script setup lang="ts">
/**
 * SeeResults — looping "see your results" worksheet illustration.
 *
 * Assembles the full results page from the pieces the viewer has produced —
 * the `miss.` verdict across the top, their sketch (a simple drawn house)
 * beside the actual target image, their ideogram and filled perception fields,
 * and an accuracy-over-time chart (hit-rate line, a confidence band that
 * narrows as sessions accrue, the dashed chance baseline, and a p-value).
 *
 * A camera scrolls down through the sheet at reading size, then pulls back to
 * frame the whole worksheet before zooming back in to loop. The camera is a
 * pure transform on the document inside a fixed-height viewport (no real
 * scroll), so it stays centred and cheap at any width.
 *
 *   • Content is prop-driven: `fields`, `targetGestalt`, `ideogramPath`, and
 *     the `chartPoints` series (each point a hit-rate + band half-width, both
 *     0–1). The line / band / baseline geometry is computed from that.
 *   • Verdict colour derives from `hit`: red `miss.` or signal-blue copy.
 *   • SSR renders the worksheet; the camera starts on mount and re-measures
 *     each cycle, so it adapts to width changes. prefers-reduced-motion: holds
 *     the zoomed-out whole-sheet view, static.
 *   • Decorative (aria-hidden) — surrounding copy carries the meaning.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

interface Field { label: string, value: string }
interface ChartPoint { hitRate: number, band: number }

const props = withDefaults(defineProps<{
  title?: string
  verdictLabel?: string
  /** true → signal-blue verdict; false → locked red. Default miss. */
  hit?: boolean
  fields?: Field[]
  targetGestalt?: string
  ideogramPath?: string
  /** Accuracy series, oldest → newest. hitRate and band are 0–1. */
  chartPoints?: ChartPoint[]
  chancePct?: number
  pValue?: string
  /** Overrides the derived "NN%" readout if set. */
  hitRateLabel?: string
  artLight?: string
  artDark?: string
  frame?: boolean
  /** Viewport height in px. */
  height?: number
  loop?: boolean
  /** Share of the viewport the whole sheet fills when zoomed out. */
  fitMargin?: number
  /** Beat timings (ms). */
  topHoldMs?: number
  scrollMs?: number
  bottomHoldMs?: number
  zoomMs?: number
  wideHoldMs?: number
  paused?: boolean
}>(), {
  title: '// session_results',
  verdictLabel: 'miss.',
  hit: false,
  fields: () => [
    { label: 'texture_', value: 'rough, grainy' },
    { label: 'temp_', value: 'cool, dry' },
    { label: 'color_', value: 'ochre, pale' },
  ],
  targetGestalt: 'beach',
  ideogramPath: 'M10 40 C20 22 30 20 38 32 C44 41 38 49 32 43 C28 39 34 30 44 31 C57 32 68 48 82 31 C90 21 102 27 110 40',
  chartPoints: () => [
    { hitRate: 0.50, band: 0.28 },
    { hitRate: 0.30, band: 0.24 },
    { hitRate: 0.38, band: 0.19 },
    { hitRate: 0.34, band: 0.16 },
    { hitRate: 0.42, band: 0.12 },
    { hitRate: 0.44, band: 0.09 },
    { hitRate: 0.45, band: 0.07 },
  ],
  chancePct: 0.25,
  pValue: '0.04',
  hitRateLabel: '',
  artLight: '#BD6A45',
  artDark: '#C7BB9B',
  frame: true,
  height: 300,
  loop: true,
  fitMargin: 0.94,
  topHoldMs: 750,
  scrollMs: 5400,
  bottomHoldMs: 450,
  zoomMs: 1500,
  wideHoldMs: 2500,
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

const verdictClass = computed(() => (props.hit ? 'is-hit' : 'is-miss'))
const chanceLabel = computed(() => `chance ${Math.round(props.chancePct * 100)}%`)

// Chart geometry, computed from the points series within a fixed plot box.
const chart = computed(() => {
  const pts = props.chartPoints
  const n = pts.length
  const X0 = 30, X1 = 270, Y0 = 12, Y1 = 120
  const xAt = (i: number) => (n <= 1 ? X0 : X0 + (i / (n - 1)) * (X1 - X0))
  const yAt = (r: number) => Math.max(Y0, Math.min(Y1, Y1 - r * (Y1 - Y0)))
  const fmt = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`

  const line = pts.map((p, i) => fmt(xAt(i), yAt(p.hitRate))).join(' ')
  const upper = pts.map((p, i) => fmt(xAt(i), yAt(p.hitRate + p.band)))
  const lower = pts.map((p, i) => fmt(xAt(i), yAt(p.hitRate - p.band))).reverse()
  const band = upper.concat(lower).join(' ')
  const chanceY = yAt(props.chancePct)

  const last = pts[pts.length - 1]
  const dotX = last ? xAt(n - 1) : 0
  const dotY = last ? yAt(last.hitRate) : 0
  const derivedLabel = last ? `${Math.round(last.hitRate * 100)}%` : ''
  return { line, band, chanceY, dotX, dotY, label: props.hitRateLabel || derivedLabel }
})

// ── Camera (client-only) ─────────────────────────────────────────────────────
const rootEl = ref<HTMLElement | null>(null)
const docEl = ref<HTMLElement | null>(null)
let vh = 0
let docH = 0
let zFit = 1
let active = false
let timer: ReturnType<typeof setTimeout> | null = null

function delay(ms: number) {
  return new Promise<void>((resolve) => { timer = setTimeout(resolve, ms) })
}

function measure() {
  const root = rootEl.value
  const doc = docEl.value
  if (!root || !doc) return
  vh = root.clientHeight
  doc.style.transition = 'none'
  doc.style.transform = 'none'
  docH = doc.offsetHeight
  zFit = (vh / docH) * props.fitMargin
  doc.style.transformOrigin = '50% 0'
}

function cam(z: number, focusY: number) {
  const doc = docEl.value
  if (!doc) return
  const ty = vh / 2 - focusY * z
  doc.style.transform = `translateY(${ty}px) scale(${z})`
}

const EASE = 'cubic-bezier(.4,0,.2,1)'

async function runLoop() {
  active = true
  const doc = docEl.value
  if (!doc) return
  do {
    measure()
    cam(1, vh / 2)
    if (rootEl.value) void rootEl.value.offsetWidth

    await delay(props.topHoldMs)
    if (!active) return

    doc.style.transition = `transform ${props.scrollMs}ms ease-in-out`
    cam(1, docH - vh / 2)
    await delay(props.scrollMs + props.bottomHoldMs)
    if (!active) return

    doc.style.transition = `transform ${props.zoomMs}ms ${EASE}`
    cam(zFit, docH / 2)
    await delay(props.zoomMs + props.wideHoldMs)
    if (!active) return

    doc.style.transition = `transform ${props.zoomMs}ms ${EASE}`
    cam(1, vh / 2)
    await delay(props.zoomMs + 120)
  } while (active && props.loop)
  active = false
}

function staticView() {
  measure()
  cam(zFit, docH / 2)
}

function stop() {
  active = false
  if (timer) { clearTimeout(timer); timer = null }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

onMounted(() => {
  if (prefersReducedMotion()) { staticView(); return }
  if (!props.paused) runLoop()
})
onBeforeUnmount(stop)
watch(() => props.paused, (p) => { if (p) stop(); else if (!active) runLoop() })
</script>

<template>
  <div
    ref="rootEl"
    class="results"
    :class="{ 'results--framed': frame }"
    :style="{
      height: `${height}px`,
      '--results-art-light': artLight,
      '--results-art-dark': artDark,
    }"
    aria-hidden="true"
  >
    <div ref="docEl" class="results-doc">
      <div class="results-head">
        <span class="results-title">{{ title }}</span>
        <span class="results-verdict" :class="verdictClass">{{ verdictLabel }}</span>
      </div>

      <div class="results-sec results-compare">
        <div class="results-cell">
          <div class="results-cap">your sketch</div>
          <div class="results-box">
            <svg class="results-sketch" viewBox="0 0 100 75">
              <path d="M16 64 L84 64" opacity=".45" />
              <path d="M30 41 L30 64" />
              <path d="M70 41 L70 64" />
              <path d="M26 43 L50 24 L74 43" />
              <path d="M30 64 L70 64" />
              <path d="M46 64 L46 52 L56 52 L56 64" />
              <path d="M36 47 L44 47 L44 55 L36 55 Z" />
              <path d="M40 47 L40 55 M36 51 L44 51" opacity=".7" />
            </svg>
          </div>
        </div>
        <div class="results-cell">
          <div class="results-cap">target</div>
          <div class="results-box">
            <svg class="results-art" viewBox="0 0 100 75" v-html="gestaltMarkup(targetGestalt)" />
          </div>
        </div>
      </div>

      <div class="results-sec results-record">
        <div class="results-ideo">
          <div class="results-cap">ideogram</div>
          <div class="results-box results-ideobox">
            <svg class="results-ideo-art" viewBox="0 0 120 60">
              <path :d="ideogramPath" />
            </svg>
          </div>
        </div>
        <div class="results-fieldcol">
          <div class="results-cap">perceptions</div>
          <div v-for="(f, i) in fields" :key="i" class="results-field">
            <span class="results-fl">{{ f.label }}</span>
            <span class="results-fv">{{ f.value }}</span>
          </div>
        </div>
      </div>

      <div class="results-sec results-chart">
        <div class="results-cap">accuracy over time</div>
        <svg class="results-ch" viewBox="0 0 280 152">
          <polygon class="ch-band" :points="chart.band" />
          <line class="ch-chance" x1="30" :y1="chart.chanceY" x2="270" :y2="chart.chanceY" />
          <polyline class="ch-line" :points="chart.line" />
          <circle class="ch-dot" :cx="chart.dotX" :cy="chart.dotY" r="3" />
          <line class="ch-axis" x1="30" y1="12" x2="30" y2="120" />
          <line class="ch-axis" x1="30" y1="120" x2="270" y2="120" />
          <text class="ch-txt" x="30" y="9">hit rate</text>
          <text class="ch-txt" x="198" :y="chart.chanceY - 4">{{ chanceLabel }}</text>
          <text class="ch-txt" x="214" y="134">sessions →</text>
        </svg>
        <div class="results-stats">
          <span class="results-stat">hit rate <b>{{ chart.label }}</b></span>
          <span class="results-pval">p = {{ pValue }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  font-family: var(--psy-font-mono);
  color: var(--psy-text);
}

.results--framed {
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
}

.results-doc {
  padding: 14px 16px 16px;
  will-change: transform;
}

.results-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--psy-line);
  margin-bottom: 12px;
}

.results-title {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--psy-text-muted);
}

.results-verdict {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.results-verdict.is-miss { color: var(--psy-locked); }
.results-verdict.is-hit { color: var(--psy-signal); }
:global(.dark) .results-verdict.is-miss { color: var(--psy-locked-fg); }

.results-sec {
  padding-bottom: 13px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--psy-line);
}

.results-sec:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.results-cap {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--psy-text-muted);
  margin-bottom: 6px;
}

.results-compare {
  display: flex;
  gap: 12px;
}

.results-cell { flex: 1; }

.results-box {
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius);
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.results-sketch { width: 76%; height: 76%; }
.results-sketch path {
  stroke: var(--psy-text);
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.results-art { width: 72%; height: 72%; color: var(--results-art-light); }
:global(.dark) .results-art { color: var(--results-art-dark); }

.results-record {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.results-ideo { width: 42%; }
.results-ideobox { aspect-ratio: 2 / 1; }
.results-ideo-art { width: 86%; height: 86%; }
.results-ideo-art path {
  stroke: var(--psy-text);
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.results-fieldcol { flex: 1; }

.results-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.results-field:last-child { margin-bottom: 0; }

.results-fl {
  width: 56px;
  font-size: 10px;
  color: var(--psy-text-muted);
}

.results-fv {
  flex: 1;
  font-size: 11px;
  color: var(--psy-text);
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius);
  padding: 4px 8px;
}

.results-ch {
  width: 100%;
  height: auto;
  display: block;
}

.ch-band { fill: var(--psy-signal); opacity: 0.15; }
.ch-line {
  stroke: var(--psy-signal);
  fill: none;
  stroke-width: 2.4;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.ch-chance {
  stroke: var(--psy-text-muted);
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
}
.ch-axis { stroke: var(--psy-line-strong); stroke-width: 1; }
.ch-dot { fill: var(--psy-signal); }
.ch-txt {
  fill: var(--psy-text-muted);
  font-size: 9px;
  font-family: var(--psy-font-mono);
}

.results-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: var(--psy-text-muted);
}

.results-stat b { color: var(--psy-text); font-weight: 600; }
.results-pval { color: var(--psy-text); font-weight: 600; }
</style>
