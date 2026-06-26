<template>
  <UModal
    v-model:open="open"
    :dismissible="dismissible"
    :ui="{
      content: `${widthClass} max-w-[calc(100vw-2rem)] bg-transparent ring-0 shadow-none divide-y-0`,
      overlay: 'bg-black/60 backdrop-blur-sm',
    }"
  >
    <template #content>
      <div class="terminal">
        <!-- Header — replicates the access_terminal (sign-in/up) header exactly -->
        <div class="terminal-head">
          <div>
            <p class="eyebrow" :class="`eyebrow--${tone}`">// {{ eyebrow }}</p>
            <h2 class="title">{{ title }}<span class="blink">_</span></h2>
          </div>
          <button class="close" type="button" aria-label="close" :disabled="closeDisabled" @click="open = false">×</button>
        </div>

        <div class="terminal-body">
          <slot />
        </div>

        <div v-if="$slots.footer" class="terminal-foot">
          <slot name="footer" />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Shared dialog shell — single source of truth for the terminal chrome + header
// so every dialog matches the sign-in/sign-up dialog exactly.
const open = defineModel<boolean>('open', { default: false })

withDefaults(defineProps<{
  eyebrow: string
  title: string
  tone?: 'faint' | 'signal' | 'warn'
  widthClass?: string
  dismissible?: boolean
  closeDisabled?: boolean
}>(), {
  tone: 'faint',
  widthClass: 'w-[420px]',
  dismissible: true,
  closeDisabled: false,
})
</script>

<style scoped>
/* ── Terminal shell (copied verbatim from AuthDialog) ─────────────────────── */
.terminal {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(100dvh - 4rem);
  width: 100%;
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  padding: 26px 26px 22px;
  box-shadow: var(--psy-shadow-md, 0 24px 60px rgba(0, 0, 0, 0.45));
}

.terminal-head {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.terminal-body {
  min-height: 0;
  overflow-y: auto;
  margin-top: 22px;
}

.terminal-foot {
  flex-shrink: 0;
  margin-top: 20px;
}

.eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
}

.eyebrow--signal { color: var(--psy-signal); }
.eyebrow--warn { color: var(--psy-locked-fg); }

.title {
  margin-top: 6px;
  font-family: var(--psy-font-mono);
  font-size: 23px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--psy-text-highlighted);
}

.blink {
  color: var(--psy-signal);
  animation: psy-blink 1.15s step-end infinite;
}

.close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--psy-line-strong);
  border-radius: 2px;
  color: var(--psy-text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.close:hover:not(:disabled) { color: var(--psy-text); border-color: var(--psy-text-faint); }
.close:disabled { opacity: 0.6; cursor: default; }
</style>
