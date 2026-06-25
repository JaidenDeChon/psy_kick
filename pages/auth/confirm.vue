<template>
  <div class="confirm-screen">
    <div class="terminal-card">
      <p class="eyebrow" :class="{ signal: status === 'ok' }">// {{ eyebrow }}</p>
      <h1 class="title">{{ heading }}<span v-if="status === 'working'" class="blink">_</span></h1>
      <p class="msg">{{ message }}</p>

      <NuxtLink v-if="status !== 'working'" class="cta" :to="status === 'ok' ? '/sessions' : '/'">
        {{ status === 'ok' ? 'continue →' : '← back home' }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
type Status = 'working' | 'ok' | 'error'

const router = useRouter()
const { syncFrom } = useAuth()

const status = ref<Status>('working')
const detail = ref('')

const eyebrow = computed(() =>
  status.value === 'ok' ? 'access_granted' : status.value === 'error' ? 'access_denied' : 'access_terminal',
)
const heading = computed(() =>
  status.value === 'ok' ? 'identity_linked' : status.value === 'error' ? 'link_failed' : 'verifying',
)
const message = computed(() => {
  if (status.value === 'ok') return 'Your account is confirmed. Signing in…'
  if (status.value === 'error') return detail.value || 'That link is invalid or has expired. Try signing in again.'
  return 'Confirming your access token…'
})

onMounted(async () => {
  // Surface any provider/verify error passed back in the URL (hash or query).
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const urlError = hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error')
  if (urlError) {
    status.value = 'error'
    detail.value = decodeURIComponent(urlError.replace(/\+/g, ' '))
    return
  }

  try {
    const sb = await useSupabase() // creates client + processes any session in the URL
    // For an email-change upgrade the persisted session needs refreshing to pick
    // up is_anonymous = false; this also no-ops cleanly for the OAuth/signup cases.
    await sb.auth.refreshSession()
    const { data: { user } } = await sb.auth.getUser()

    if (user && !user.is_anonymous) {
      syncFrom(user)
      status.value = 'ok'
      setTimeout(() => router.replace('/sessions'), 1400)
    }
    else {
      status.value = 'error'
      detail.value = 'Could not confirm this link — it may have already been used or expired.'
    }
  }
  catch (e) {
    status.value = 'error'
    detail.value = (e as { message?: string })?.message ?? 'Confirmation failed.'
  }
})
</script>

<style scoped>
.confirm-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 40px 24px;
}

.terminal-card {
  width: min(420px, 100%);
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  padding: 30px 28px;
  text-align: center;
}

.eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
}

.eyebrow.signal { color: var(--psy-signal); }

.title {
  margin-top: 8px;
  font-family: var(--psy-font-mono);
  font-size: 24px;
  font-weight: 600;
  color: var(--psy-text-highlighted);
}

.blink {
  color: var(--psy-signal);
  animation: psy-blink 1.15s step-end infinite;
}

.msg {
  margin-top: 14px;
  font-family: var(--psy-font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--psy-text-muted);
}

.cta {
  display: inline-block;
  margin-top: 22px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--psy-signal);
  text-decoration: none;
}

.cta:hover { text-decoration: underline; }
</style>
