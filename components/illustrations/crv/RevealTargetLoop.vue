<script setup lang="ts">
/**
 * RevealTarget — looping "reveal the target" illustration.
 *
 * Opens on the judged grid (the end-state of JudgeDecoys): four ranked cards,
 * the viewer's own #1 outlined in signal blue. Then the *actual* target — a
 * card the viewer did NOT rank first — blooms to fill the stage while the
 * others fade, the header flips `your_ranking → target_revealed`, and a red
 * `✗ miss` verdict blinks a few times before holding steady.
 *
 * The teaching point: blue is the viewer's pick, not the truth. The blue card
 * lingers a beat longer than the rest as it fades, so the eye catches that the
 * blue one isn't the revealed target.
 *
 *   • Single instance, themed via --psy tokens. Gestalt art is terracotta on
 *     paper, warm neutral in dark (both overridable).
 *   • `targetIndex` picks the revealed card. Verdict derives from its rank:
 *     rank 1 → blue `✓ hit` (and the card keeps its blue frame); otherwise
 *     red `✗ miss` with an ink frame. Default target is the beach at #4.
 *   • The bloom is a measured FLIP, so the target fills ~`fillRatio` of the
 *     stage and stays centred at any panel size.
 *   • SSR-safe: renders the static ranked grid. Motion starts on mount.
 *     prefers-reduced-motion: shows the revealed end-state (target filled,
 *     verdict solid, no blink, no animation).
 *   • Decorative (aria-hidden) — the instructional copy carries the meaning.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

interface Candidate { gestalt: string, rank: number }

const props = withDefaults(defineProps<{
  /** Cards in grid order; `rank` is the 1–4 the viewer assigned. */
  candidates?: Candidate[]
  /** Index of the card that is the actual target (the one that blooms). */
  targetIndex?: number
  /** Panel chrome. */
  frame?: boolean
  /** Loop forever, or run once and rest on the reveal. */
  loop?: boolean
  /** Gestalt art colour, per mode. */
  artLight?: string
  artDark?: string
  /** Header copy. */
  rankingLabel?: string
  revealedLabel?: string
  hitLabel?: string
  missLabel?: string
  /** Share of the stage the bloomed target fills (0–1). */
  fillRatio?: number
  /** How many times the verdict blinks before settling. */
  blinkCount?: number
  /** Beat timings (ms). */
  holdMs?: number
  blinkDelayMs?: number
  revealHoldMs?: number
  /** Extra fade delay on the viewer's #1 card so the blue lingers (ms). */
  lingerMs?: number
  /** Pause / resume. */
  paused?: boolean
}>(), {
  candidates: () => ([
    { gestalt: 'beach', rank: 4 },
    { gestalt: 'car', rank: 3 },
    { gestalt: 'mug', rank: 2 },
    { gestalt: 'mountain', rank: 1 },
  ]),
  targetIndex: 0,
  frame: true,
  loop: true,
  artLight: '#BD6A45',
  artDark: '#C7BB9B',
  rankingLabel: '// your_ranking',
  revealedLabel: '▣ target_revealed',
  hitLabel: '✓ hit',
  missLabel: '✗ miss',
  fillRatio: 0.92,
  blinkCount: 3,
  holdMs: 1500,
  blinkDelayMs: 420,
  revealHoldMs: 2200,
  lingerMs: 300,
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

const topIndex = computed(() => props.candidates.findIndex(c => c.rank === 1))
const isHit = computed(() => props.candidates[props.targetIndex]?.rank === 1)
const verdictLabel = computed(() => (isHit.value ? props.hitLabel : props.missLabel))
const verdictClass = computed(() => (isHit.value ? 'is-hit' : 'is-miss'))

const phase = ref<'ranking' | 'revealed'>('ranking')

const rootEl = ref<HTMLElement | null>(null)
let stageEl: HTMLElement | null = null
let metaEl: HTMLElement | null = null
let targetCard: HTMLElement | null = null
let others: HTMLElement[] = []

// ── Animation controller (client-only) ──────────────────────────────────────
let active = false
let timer: ReturnType<typeof setTimeout> | null = null

function delay(ms: number) {
  return new Promise<void>((resolve) => { timer = setTimeout(resolve, ms) })
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Measure the FLIP transform that grows the target to fill the stage.
function flipTransform(): string {
  if (!targetCard || !stageEl) return ''
  const st = stageEl.getBoundingClientRect()
  const cd = targetCard.getBoundingClientRect()
  const s = Math.min(st.width * props.fillRatio / cd.width, st.height * props.fillRatio / cd.height)
  const endW = cd.width * s
  const endH = cd.height * s
  const dx = (st.left + (st.width - endW) / 2) - cd.left
  const dy = (st.top + (st.height - endH) / 2) - cd.top
  targetCard.style.transformOrigin = '0 0'
  targetCard.style.zIndex = '5'
  return `translate(${dx}px,${dy}px) scale(${s})`
}

function clearTarget() {
  if (!targetCard) return
  targetCard.style.transform = ''
  targetCard.style.zIndex = ''
  targetCard.style.transformOrigin = ''
  targetCard.classList.remove('target')
  const badge = targetCard.querySelector('.reveal-rank')
  if (badge) badge.classList.remove('hide')
}

// Snap everything back to the ranked grid with no transition (used on (re)start).
function hardReset() {
  phase.value = 'ranking'
  if (targetCard) targetCard.style.transition = 'none'
  others.forEach((el) => { el.style.transition = 'none' })
  if (stageEl) { stageEl.style.transition = 'none'; stageEl.style.opacity = '1' }
  clearTarget()
  others.forEach((el) => { el.classList.remove('gone'); el.style.transitionDelay = '0ms' })
  if (metaEl) { metaEl.classList.remove('blink'); metaEl.style.opacity = '' }
  if (rootEl.value) void rootEl.value.offsetWidth
  if (targetCard) targetCard.style.transition = ''
  others.forEach((el) => { el.style.transition = '' })
  if (stageEl) stageEl.style.transition = ''
}

async function runLoop() {
  active = true
  hardReset()
  do {
    await delay(props.holdMs)
    if (!active) return

    // Reveal: flip the target up to fill, fade the rest (blue card lingers).
    phase.value = 'revealed'
    if (targetCard) {
      targetCard.classList.add('target')
      const badge = targetCard.querySelector('.reveal-rank')
      if (badge) badge.classList.add('hide')
      const tf = flipTransform()
      requestAnimationFrame(() => { if (targetCard) targetCard.style.transform = tf })
    }
    others.forEach((el) => {
      el.style.transitionDelay = el.classList.contains('top') ? `${props.lingerMs}ms` : '0ms'
      el.classList.add('gone')
    })

    await delay(props.blinkDelayMs)
    if (!active) return
    if (metaEl) metaEl.classList.add('blink')

    await delay(props.revealHoldMs)
    if (!active) return

    // Crossfade reset: fade the stage out, snap back, fade in.
    if (stageEl) { stageEl.style.transition = 'opacity .4s ease'; stageEl.style.opacity = '0' }
    phase.value = 'ranking'
    if (metaEl) metaEl.classList.remove('blink')
    await delay(440)
    if (!active) return

    if (targetCard) targetCard.style.transition = 'none'
    others.forEach((el) => { el.style.transition = 'none' })
    clearTarget()
    others.forEach((el) => { el.classList.remove('gone'); el.style.transitionDelay = '0ms' })
    if (rootEl.value) void rootEl.value.offsetWidth
    if (targetCard) targetCard.style.transition = ''
    others.forEach((el) => { el.style.transition = '' })
    if (stageEl) { stageEl.style.transition = 'opacity .4s ease'; stageEl.style.opacity = '1' }
    await delay(440)
  } while (active && props.loop)
  active = false
}

function staticReveal() {
  phase.value = 'revealed'
  if (targetCard) {
    targetCard.classList.add('target')
    const badge = targetCard.querySelector('.reveal-rank')
    if (badge) badge.classList.add('hide')
    const tf = flipTransform()
    targetCard.style.transition = 'none'
    targetCard.style.transform = tf
  }
  others.forEach((el) => el.classList.add('gone'))
  if (metaEl) metaEl.style.opacity = '1'
}

function stop() {
  active = false
  if (timer) { clearTimeout(timer); timer = null }
}

function collect() {
  const r = rootEl.value
  if (!r) return
  stageEl = r.querySelector('.reveal-stage')
  metaEl = r.querySelector('.reveal-meta')
  targetCard = r.querySelector('.reveal-target')
  others = Array.from(r.querySelectorAll<HTMLElement>('.reveal-card')).filter(c => c !== targetCard)
}

onMounted(() => {
  collect()
  if (prefersReducedMotion()) { staticReveal(); return }
  if (!props.paused) runLoop()
})
onBeforeUnmount(stop)
watch(() => props.paused, (p) => { if (p) stop(); else if (!active) runLoop() })
</script>

<template>
  <div
    ref="rootEl"
    class="reveal"
    :class="{ 'reveal--framed': frame }"
    :style="{
      '--reveal-art-light': artLight,
      '--reveal-art-dark': artDark,
      '--reveal-blink-count': blinkCount,
    }"
    aria-hidden="true"
  >
    <div class="reveal-head" :class="{ revealed: phase === 'revealed' }">
      <span class="reveal-label">{{ phase === 'revealed' ? revealedLabel : rankingLabel }}</span>
      <span class="reveal-meta" :class="verdictClass">{{ verdictLabel }}</span>
    </div>

    <div class="reveal-stage">
      <div class="reveal-grid">
        <div
          v-for="(c, i) in candidates"
          :key="i"
          class="reveal-card"
          :class="{ top: i === topIndex, 'reveal-target': i === targetIndex }"
        >
          <svg class="reveal-art" viewBox="0 0 100 75" v-html="gestaltMarkup(c.gestalt)" />
          <div class="reveal-rank">{{ c.rank }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reveal {
  position: relative;
  font-family: var(--psy-font-mono);
}

.reveal--framed {
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  padding: 14px;
}

.reveal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 18px;
  margin-bottom: 10px;
}

.reveal-label {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--psy-text-muted);
  transition: color 0.45s ease;
}

.reveal-head.revealed .reveal-label {
  color: var(--psy-signal);
}

.reveal-meta {
  font-size: 11px;
  letter-spacing: 0.06em;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.reveal-meta.is-miss { color: var(--psy-locked); }
.reveal-meta.is-hit { color: var(--psy-signal); }

:global(.dark) .reveal-meta.is-miss { color: var(--psy-locked-fg); }

@keyframes reveal-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.reveal-meta.blink {
  animation: reveal-blink 0.24s ease-in-out var(--reveal-blink-count, 3) forwards;
}

.reveal-stage {
  position: relative;
}

.reveal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.reveal-card {
  position: relative;
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: 3px;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--reveal-art-light);
  transition:
    transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 0.55s ease,
    border-color 0.45s ease,
    box-shadow 0.45s ease;
}

:global(.dark) .reveal-card { color: var(--reveal-art-dark); }

.reveal-card.gone { opacity: 0; }

/* .target before .top: a missed target gets the ink frame; a hit (target is
   also #1) keeps its blue frame because .top wins on source order. */
.reveal-card.target {
  border-color: var(--psy-text);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.2);
}

.reveal-card.top {
  border-color: var(--psy-signal);
  box-shadow: 0 0 0 1px var(--psy-signal), 0 0 16px var(--psy-signal-glow);
}

.reveal-art {
  width: 72%;
  height: 72%;
}

.reveal-rank {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 21px;
  height: 21px;
  border-radius: 2px;
  border: 1px solid var(--psy-line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--psy-text);
  background: var(--psy-bg-base);
  transition: opacity 0.3s ease;
}

.reveal-card.top .reveal-rank {
  border-color: var(--psy-signal);
  background: var(--psy-signal);
  color: #F6F1E5;
}

.reveal-rank.hide { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .reveal-card { transition: none !important; }
  .reveal-meta.blink { animation: none; }
}
</style>
