<template>
  <!-- Hit-rate vs the 25% chance baseline. Kept quiet (manila) per the design
       discipline — standings are data, not signal (design README §8). -->
  <div class="ratebar" :title="`${Math.round(rate * 100)}% · chance = 25%`">
    <div class="ratebar-track">
      <div class="ratebar-fill" :style="{ width: clamped + '%' }" />
      <div class="ratebar-tick" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ rate: number }>()
const clamped = computed(() => Math.max(0, Math.min(100, (props.rate ?? 0) * 100)))
</script>

<style scoped>
.ratebar { width: 100%; }
.ratebar-track {
  position: relative;
  height: 8px;
  background: var(--psy-bg-panel);
  border: 1px solid var(--psy-line);
  overflow: hidden;
}
.ratebar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--psy-tan);
}
/* 25% chance baseline marker */
.ratebar-tick {
  position: absolute;
  top: -1px; bottom: -1px;
  left: 25%;
  width: 1px;
  background: var(--psy-text-faint);
}
</style>
