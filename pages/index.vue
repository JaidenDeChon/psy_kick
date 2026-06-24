<template>
  <section class="home-hero">
    <div class="hero-eyebrow">// remote viewing practice · blind sessions · score tracking</div>

    <h1 class="hero-wordmark">psy_kick<span class="blink-underscore">_</span></h1>

    <p class="hero-lede">
      <strong>Ready when you are.</strong> Once we begin, the server selects a target image.
      You won't see it — that's the point — until you're done.
    </p>

    <div class="hero-actions">
      <button class="begin-button" @click="goToSessions">begin_session →</button>
      <span v-if="lastSession" class="hero-last">
        last · <span class="ref">{{ refA }}<span class="ref-dash">—</span>{{ refB }}</span> ·
        <span :class="lastSession.hit ? 'last-hit' : 'last-miss'">{{ lastSession.hit ? 'hit' : 'miss' }}</span>
        · {{ lastSession.date }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
// The homepage does ZERO Supabase work — it just paints. The "last session"
// meta is shown only when another page (history) has already cached it.
const router = useRouter()

interface LastSession { reference_number: string; hit: boolean; date: string }
const lastSession = useState<LastSession | null>('lastSession', () => null)

const refA = computed(() => lastSession.value?.reference_number.split('—')[0] ?? '')
const refB = computed(() => lastSession.value?.reference_number.split('—')[1] ?? '')

function goToSessions() {
  router.push('/sessions')
}
</script>

<style scoped>
.home-hero {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(56px, 12vw, 120px) clamp(22px, 6vw, 72px);
}

.hero-eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 24px;
}

.hero-wordmark {
  font-family: var(--psy-font-mono);
  font-size: clamp(44px, 9vw, 72px);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--psy-text-highlighted);
  margin: 0;
}

.blink-underscore {
  color: var(--psy-signal);
  animation: psy-blink 1.15s step-end infinite;
}

.hero-lede {
  margin: 26px 0 0;
  font-size: 16px;
  line-height: 1.75;
  color: var(--psy-text-muted);
  max-width: 520px;
}

.hero-lede strong {
  color: var(--psy-text-highlighted);
  font-weight: 700;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 34px;
  flex-wrap: wrap;
}

.begin-button {
  background: var(--psy-signal);
  color: #fff;
  border: none;
  padding: 16px 32px;
  font-family: var(--psy-font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 2px;
}

.begin-button:hover {
  background: var(--psy-signal-400, var(--psy-signal));
}

.hero-last {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--psy-text-faint);
}

.hero-last .ref-dash { color: var(--psy-tan); }
.hero-last .last-hit { color: var(--psy-hit); }
.hero-last .last-miss { color: var(--psy-miss); }

@media (max-width: 520px) {
  .hero-eyebrow {
    font-size: 10px;
    letter-spacing: 0.14em;
  }
}
</style>
