<template>
  <DialogShell
    v-model:open="open"
    eyebrow="active_session"
    title="one_at_a_time"
    tone="warn"
    width-class="w-[460px]"
  >
    <p class="lede">
      <template v-if="sessions.length === 1">
        You already have a CRV session in progress:
        <span class="ref">{{ sessions[0]!.reference_number }}</span>.
      </template>
      <template v-else>
        You have <span class="ref">{{ sessions.length }}</span> CRV sessions in progress.
      </template>
    </p>
    <p class="lede lede--subtle">
      Only one Controlled Remote Viewing session can be active at a time.
      <template v-if="sessions.length === 1">
        Resume where you left off, or cancel it to start a new target.
      </template>
      <template v-else>
        Resume or clear them from the list before starting a new target.
      </template>
    </p>

    <template #footer>
      <div class="foot">
        <button
          v-if="sessions.length === 1"
          class="ghost"
          @click="$emit('cancel-restart')"
        >
          cancel_and_start_new
        </button>
        <button class="primary" @click="$emit('resume')">
          {{ sessions.length === 1 ? 'resume_session →' : 'review_active →' }}
        </button>
      </div>
    </template>
  </DialogShell>
</template>

<script setup lang="ts">
// Shown when "begin" is pressed while a session of this type is still in
// progress. Only one is allowed at a time, so the choice is resume vs. cancel.
const open = defineModel<boolean>('open', { default: false })

defineProps<{
  sessions: { id: string; status: string; reference_number: string }[]
}>()

defineEmits<{ resume: []; 'cancel-restart': [] }>()
</script>

<style scoped>
.lede {
  font-family: var(--psy-font-sans);
  font-size: 15px;
  line-height: 1.65;
  color: var(--psy-text-muted);
}

.lede--subtle {
  margin-top: 12px;
  color: var(--psy-text-faint);
}

.ref {
  font-family: var(--psy-font-mono);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--psy-signal);
}

.foot {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
}

.ghost {
  background: transparent;
  border: 1px solid var(--psy-line-strong);
  border-radius: 2px;
  padding: 12px 18px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--psy-text-muted);
  cursor: pointer;
}

.ghost:hover { color: var(--psy-text); border-color: var(--psy-text-faint); }

.primary {
  background: var(--psy-signal);
  color: #fff;
  border: none;
  border-radius: 2px;
  padding: 12px 20px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.primary:hover { background: var(--psy-signal-400, var(--psy-signal)); }
</style>
