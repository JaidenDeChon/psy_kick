<template>
  <DialogShell v-model:open="open" eyebrow="get ready to read a lot" title="how_this_works" width-class="w-[680px]">
    <ProtocolSteps layout="stack" intro />

    <template #footer>
      <div class="dialog-foot">
        <UButton
          size="lg"
          color="neutral"
          variant="outline"
          style="font-family: var(--psy-font-mono); letter-spacing: 0.06em"
          @click="open = false"
        >
          that was a lot to read
        </UButton>
      </div>
    </template>
  </DialogShell>
</template>

<script setup lang="ts">
// The how_this_works explainer — shared by the CRV protocol card (sessions page)
// and the cool-down screen.
const open = defineModel<boolean>('open', { default: false })
</script>

<style scoped>
.dialog-foot {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
