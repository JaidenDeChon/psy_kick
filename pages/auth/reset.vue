<template>
  <div class="reset-screen">
    <div class="terminal-card">
      <p class="eyebrow">// recover_access</p>
      <h1 class="title">reset_password<span class="blink">_</span></h1>

      <!-- Invalid / expired recovery link -->
      <template v-if="state === 'invalid'">
        <p class="msg">This reset link is invalid or has expired. Request a new one from sign_in.</p>
        <NuxtLink class="cta" to="/">← back home</NuxtLink>
      </template>

      <!-- Done -->
      <template v-else-if="state === 'done'">
        <p class="eyebrow signal" style="margin-top: 16px">// password_updated</p>
        <p class="msg">Your password is set. Signing in…</p>
        <NuxtLink class="cta" to="/sessions">continue →</NuxtLink>
      </template>

      <!-- Set new password -->
      <form v-else class="form" @submit.prevent="submit">
        <div class="field">
          <label class="micro" for="reset-password">new_password</label>
          <input
            id="reset-password"
            v-model="password"
            class="input"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            required
            minlength="6"
            :disabled="loading"
          >
          <p class="hint">min 6 characters</p>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="primary" type="submit" :disabled="loading || state === 'loading'">
          {{ loading ? '···' : 'set_password →' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
type State = 'loading' | 'ready' | 'invalid' | 'done'

const router = useRouter()
const { setPassword } = useAuth()

const state = ref<State>('loading')
const password = ref('')
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  if (hash.get('error') || hash.get('error_description')) {
    state.value = 'invalid'
    return
  }
  try {
    const sb = await useSupabase() // detects the recovery session in the URL
    const { data: { session } } = await sb.auth.getSession()
    state.value = session ? 'ready' : 'invalid'
  }
  catch {
    state.value = 'invalid'
  }
})

async function submit() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await setPassword(password.value)
    state.value = 'done'
    setTimeout(() => router.replace('/sessions'), 1400)
  }
  catch (e) {
    error.value = (e as { message?: string })?.message ?? 'Could not update password.'
  }
  finally {
    loading.value = false
  }
}
</script>

<style scoped>
.reset-screen {
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

.form { margin-top: 22px; }
.field { margin-bottom: 16px; }

.micro {
  display: block;
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--psy-tan);
  margin-bottom: 7px;
}

.input {
  width: 100%;
  background: var(--psy-bg-inset);
  border: 1px solid var(--psy-line-strong);
  border-radius: 2px;
  padding: 12px 13px;
  font-family: var(--psy-font-mono);
  font-size: 14px;
  color: var(--psy-text);
  outline: none;
}

.input:focus { border-color: var(--psy-signal); box-shadow: 0 0 0 1px var(--psy-signal); }

.hint {
  margin-top: 6px;
  font-family: var(--psy-font-mono);
  font-size: 10px;
  color: var(--psy-text-faint);
}

.error {
  margin: 4px 0 14px;
  font-family: var(--psy-font-mono);
  font-size: 12px;
  color: var(--psy-locked);
}

.primary {
  width: 100%;
  background: var(--psy-signal);
  color: #fff;
  border: none;
  border-radius: 2px;
  padding: 14px;
  font-family: var(--psy-font-mono);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.primary:hover:not(:disabled) { background: var(--psy-signal-400, var(--psy-signal)); }
.primary:disabled { opacity: 0.6; cursor: default; }

.msg {
  margin-top: 14px;
  font-family: var(--psy-font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--psy-text-muted);
}

.cta {
  display: inline-block;
  margin-top: 20px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--psy-signal);
  text-decoration: none;
}

.cta:hover { text-decoration: underline; }
</style>
