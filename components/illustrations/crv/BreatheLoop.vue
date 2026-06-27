<template>
  <div class="orb-container">
    <div class="orb-ring psy-glow" :style="ring1Style" />
    <div class="orb-ring psy-glow" :style="ring2Style" />
    <div class="orb-core psy-glow" />
  </div>
</template>

<script setup lang="ts">
// BreatheLoop — the slow inhale/exhale pulse shown on the cool-down screen and
// on the "clear your mind" slide of how_this_works. Two rings expand outward on
// offset cycles around a scaling core. All motion is driven by the global
// `psy-breath` / `psy-ring` keyframes in assets/css/main.css, so it themes and
// honours reduced-motion the same way the cool-down route always has.
const ring1Style = { animation: 'psy-ring 3.5s ease-out infinite' }
const ring2Style = { animation: 'psy-ring 3.5s ease-out infinite 1.75s' }
</script>

<style scoped>
.orb-container {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.orb-core {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--psy-signal-400, #339BFF), var(--psy-signal));
  animation: psy-breath 4.6s ease-in-out infinite;
}

.orb-ring {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--psy-signal);
  opacity: 0;
}
</style>
