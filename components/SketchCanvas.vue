<template>
  <div
    class="sketch-canvas-wrap"
    :class="[size === 'small' ? 'sketch-small' : 'sketch-normal', locked ? 'is-locked' : '']"
    :style="wrapStyle"
  >
    <!-- Canvas -->
    <canvas
      ref="canvasEl"
      class="sketch-canvas"
      :style="{ touchAction: 'none', cursor: locked ? 'default' : (activeTool === 'pen' ? 'crosshair' : 'cell') }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onLeave"
    />

    <!-- Empty hint -->
    <div
      v-if="!locked && strokes.length === 0 && !drawing"
      class="sketch-hint label-mono"
      style="color: var(--psy-text-faint); pointer-events: none"
    >
      draw here_
    </div>

    <!-- Toolbar — unmounted when locked -->
    <div v-if="!locked" class="sketch-toolbar">
      <button
        :class="['toolbar-btn', activeTool === 'pen' ? 'active' : '']"
        title="Pen"
        @click="activeTool = 'pen'"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 12L5 9L11 3L12 4L6 10L3 13L2 12Z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
          <path d="M10 2L12 4" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
      <button
        :class="['toolbar-btn', activeTool === 'erase' ? 'active' : '']"
        title="Eraser"
        @click="activeTool = 'erase'"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="5" width="10" height="5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <path d="M6 10L4 12" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>

      <div class="toolbar-divider" />

      <button
        :class="['toolbar-btn', strokeWidth === THIN ? 'active' : '']"
        title="Thin stroke"
        @click="strokeWidth = THIN"
      >
        <span class="stroke-dot thin" />
      </button>
      <button
        :class="['toolbar-btn', strokeWidth === THICK ? 'active' : '']"
        title="Thick stroke"
        @click="strokeWidth = THICK"
      >
        <span class="stroke-dot thick" />
      </button>

      <div class="toolbar-divider" />

      <button class="toolbar-btn" title="Undo" @click="undo">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7C3 4.8 4.8 3 7 3C9.2 3 11 4.8 11 7C11 9.2 9.2 11 7 11" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/>
          <path d="M2 5L3 7L5 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="toolbar-btn" title="Clear" @click="clear">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

export interface Stroke {
  mode: 'pen' | 'erase'
  width: number
  points: [number, number][]
}

const props = withDefaults(defineProps<{
  modelValue?: Stroke[]
  locked?: boolean
  size?: 'small' | 'normal'
}>(), {
  modelValue: () => [],
  locked: false,
  size: 'normal',
})

const emit = defineEmits<{
  'update:modelValue': [strokes: Stroke[]]
}>()

const THIN = 2.5
const THICK = 6

const canvasEl = ref<HTMLCanvasElement | null>(null)
const activeTool = ref<'pen' | 'erase'>('pen')
const strokeWidth = ref(THIN)
const drawing = ref(false)

// Internal copy — updated on every commit
const strokes = ref<Stroke[]>([...props.modelValue])
let currentStroke: Stroke | null = null
let lastPointerDown = false

const wrapStyle = computed(() => ({
  '--sketch-h': props.size === 'small' ? '120px' : '260px',
}))

// ── Canvas rendering ─────────────────────────────────────────────────────────

function getCtx() {
  return canvasEl.value?.getContext('2d') ?? null
}

function toCanvas(nx: number, ny: number, w: number, h: number): [number, number] {
  return [nx * w, ny * h]
}

function renderAll() {
  const canvas = canvasEl.value
  const ctx = getCtx()
  if (!canvas || !ctx) return

  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)

  for (const stroke of strokes.value) {
    if (stroke.points.length < 2) continue
    if (stroke.mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--psy-text').trim() || '#1A1613'
    }
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    const [fx, fy] = toCanvas(stroke.points[0]![0], stroke.points[0]![1], width, height)
    ctx.moveTo(fx, fy)
    for (let i = 1; i < stroke.points.length; i++) {
      const [px, py] = toCanvas(stroke.points[i]![0], stroke.points[i]![1], width, height)
      ctx.lineTo(px, py)
    }
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'source-over'
}

function setCanvasSize() {
  const canvas = canvasEl.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)
  renderAll()
}

// ── Pointer events ────────────────────────────────────────────────────────────

function getCanvasCoords(e: PointerEvent): [number, number] {
  const canvas = canvasEl.value!
  const rect = canvas.getBoundingClientRect()
  return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]
}

function onDown(e: PointerEvent) {
  if (props.locked) return
  e.preventDefault()
  ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
  lastPointerDown = true
  drawing.value = true

  const pt = getCanvasCoords(e)
  currentStroke = { mode: activeTool.value, width: strokeWidth.value, points: [pt] }
}

function onMove(e: PointerEvent) {
  if (!drawing.value || !currentStroke || props.locked) return
  e.preventDefault()

  const events = e.getCoalescedEvents?.() ?? [e]
  for (const ce of events) {
    currentStroke.points.push(getCanvasCoords(ce))
  }

  // Draw the in-progress stroke
  const canvas = canvasEl.value
  const ctx = getCtx()
  if (!canvas || !ctx) return

  const pts = currentStroke.points
  if (pts.length < 2) return

  const { width, height } = canvas

  if (currentStroke.mode === 'erase') {
    ctx.globalCompositeOperation = 'destination-out'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--psy-text').trim() || '#1A1613'
  }
  ctx.lineWidth = currentStroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const last = pts[pts.length - 2]!
  const curr = pts[pts.length - 1]!
  ctx.beginPath()
  ctx.moveTo(...toCanvas(last[0], last[1], width, height))
  ctx.lineTo(...toCanvas(curr[0], curr[1], width, height))
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
}

function onUp(e: PointerEvent) {
  if (!drawing.value || !currentStroke || props.locked) return
  e.preventDefault()
  drawing.value = false

  if (currentStroke.points.length >= 2) {
    const next = [...strokes.value, currentStroke]
    strokes.value = next
    emit('update:modelValue', next)
  }

  currentStroke = null
  lastPointerDown = false
}

function onLeave(e: PointerEvent) {
  // Only commit if pointer is truly up (not just moving out)
  if (drawing.value && e.buttons === 0) {
    onUp(e)
  }
}

// ── Toolbar actions ──────────────────────────────────────────────────────────

function undo() {
  if (strokes.value.length === 0) return
  const next = strokes.value.slice(0, -1)
  strokes.value = next
  emit('update:modelValue', next)
  renderAll()
}

function clear() {
  strokes.value = []
  emit('update:modelValue', [])
  renderAll()
}

// ── Sync & lifecycle ──────────────────────────────────────────────────────────

watch(() => props.modelValue, (val) => {
  strokes.value = [...val]
  renderAll()
}, { deep: true })

let ro: ResizeObserver | null = null

onMounted(() => {
  setCanvasSize()
  ro = new ResizeObserver(() => setCanvasSize())
  if (canvasEl.value?.parentElement) ro.observe(canvasEl.value.parentElement)
})

onUnmounted(() => {
  ro?.disconnect()
})
</script>

<style scoped>
.sketch-canvas-wrap {
  position: relative;
  width: 100%;
  height: var(--sketch-h, 260px);
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  overflow: hidden;
}

.sketch-canvas {
  display: block;
  width: 100%;
  height: calc(100% - 36px);
}

.is-locked .sketch-canvas {
  height: 100%;
}

.sketch-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  user-select: none;
}

.sketch-toolbar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  border-top: 1px solid var(--psy-line);
  background: var(--psy-bg-panel);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: var(--psy-radius-sm);
  background: transparent;
  color: var(--psy-text-muted);
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
  padding: 0;
}

.toolbar-btn:hover {
  color: var(--psy-text);
}

.toolbar-btn.active {
  color: var(--psy-signal);
  border-color: var(--psy-signal);
  box-shadow: 0 0 10px var(--psy-signal-glow);
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--psy-line);
  margin: 0 4px;
}

.stroke-dot {
  display: block;
  border-radius: 50%;
  background: currentColor;
}
.stroke-dot.thin { width: 4px; height: 4px; }
.stroke-dot.thick { width: 8px; height: 8px; }
</style>
