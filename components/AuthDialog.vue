<template>
  <UModal
    v-model:open="open"
    :dismissible="!loading"
    :ui="{
      content: 'w-[420px] max-w-[calc(100vw-2rem)] bg-transparent ring-0 shadow-none divide-y-0',
      overlay: 'bg-black/60 backdrop-blur-sm',
    }"
  >
    <template #content>
      <div class="terminal">
        <!-- Header -->
        <div class="terminal-head">
          <div>
            <p class="eyebrow">// {{ eyebrow }}</p>
            <h2 class="title">{{ title }}<span class="blink">_</span></h2>
          </div>
          <button class="close" aria-label="close" :disabled="loading" @click="open = false">×</button>
        </div>

        <!-- Tabs (hidden in reset / sent states) -->
        <div v-if="mode !== 'reset' && !sent" class="tabs">
          <button class="tab" :class="{ active: mode === 'sign_in' }" @click="setMode('sign_in')">sign_in</button>
          <button class="tab" :class="{ active: mode === 'sign_up' }" @click="setMode('sign_up')">sign_up</button>
        </div>

        <!-- Confirmation-sent state (after sign_up or reset) -->
        <div v-if="sent" class="sent">
          <p class="eyebrow signal">// {{ sentKind }}</p>
          <p class="sent-msg">{{ sentMsg }}</p>
          <button class="link" @click="setMode('sign_in')">← back to sign_in</button>
        </div>

        <!-- Form -->
        <form v-else class="form" @submit.prevent="submit">
          <!-- sign_in + reset: one field that accepts a username OR an email -->
          <div v-if="mode !== 'sign_up'" class="field">
            <label class="micro" for="auth-identity">username</label>
            <input
              id="auth-identity"
              v-model.trim="identity"
              class="input"
              type="text"
              autocomplete="username"
              placeholder="operator_id"
              required
              :disabled="loading"
            >
          </div>

          <!-- sign_up: public username, then private email -->
          <template v-else>
            <div class="field">
              <label class="micro" for="auth-username">username</label>
              <input
                id="auth-username"
                v-model.trim="username"
                class="input"
                type="text"
                autocomplete="username"
                placeholder="operator_id"
                pattern="[A-Za-z0-9_]+"
                minlength="3"
                maxlength="20"
                required
                :disabled="loading"
              >
            </div>
            <div class="field">
              <label class="micro" for="auth-email">email</label>
              <input
                id="auth-email"
                v-model.trim="email"
                class="input"
                type="email"
                autocomplete="email"
                placeholder="you@email.com"
                required
                :disabled="loading"
              >
            </div>
          </template>

          <div v-if="mode !== 'reset'" class="field">
            <div class="field-row">
              <label class="micro" for="auth-password">password</label>
              <button v-if="mode === 'sign_in'" type="button" class="link forgot" @click="setMode('reset')">forgot?</button>
            </div>
            <input
              id="auth-password"
              v-model="password"
              class="input"
              type="password"
              :autocomplete="mode === 'sign_in' ? 'current-password' : 'new-password'"
              placeholder="••••••••"
              required
              minlength="6"
              :disabled="loading"
            >
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <button class="primary" type="submit" :disabled="loading">
            {{ loading ? '···' : primaryLabel }}
          </button>

          <template v-if="mode !== 'reset'">
            <div class="or"><span>OR</span></div>
            <button type="button" class="google" :disabled="loading" @click="googleAction">
              <span class="g-badge" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="16" height="16">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.9 26.7 37 24 37c-5.3 0-9.7-3.6-11.3-8.4l-6.5 5C9.6 40.6 16.2 45 24 45z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C40.9 35.7 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"/>
                </svg>
              </span>
              continue with google
            </button>
          </template>

          <p class="foot">
            <template v-if="mode === 'sign_in'">
              no operator id yet? <button type="button" class="link" @click="setMode('sign_up')">create one</button>
            </template>
            <template v-else-if="mode === 'sign_up'">
              already have one? <button type="button" class="link" @click="setMode('sign_in')">sign in</button>
            </template>
            <template v-else>
              remembered it? <button type="button" class="link" @click="setMode('sign_in')">sign in</button>
            </template>
          </p>
        </form>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
type Mode = 'sign_in' | 'sign_up' | 'reset'

const open = defineModel<boolean>('open', { default: false })

const { signInIdentity, signUpUsername, signInGoogle, linkGoogle, resetIdentity } = useAuth()

const mode = ref<Mode>('sign_in')
const identity = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)
const sentKind = ref('confirmation_sent')
const sentMsg = ref('')

const eyebrow = computed(() => (mode.value === 'reset' ? 'RECOVER_ACCESS' : 'ACCESS_TERMINAL'))
const title = computed(() => (mode.value === 'reset' ? 'reset_access' : mode.value))
const primaryLabel = computed(() => {
  if (mode.value === 'sign_in') return 'access_session →'
  if (mode.value === 'sign_up') return 'create_operator →'
  return 'send_reset_link →'
})

function setMode(next: Mode) {
  mode.value = next
  error.value = ''
  sent.value = false
}

function friendlyError(e: unknown): string {
  const err = e as { data?: { message?: string }; message?: string }
  const msg = err?.data?.message ?? err?.message ?? 'Something went wrong'
  if (/provider is not enabled|Unsupported provider/i.test(msg)) {
    return 'Google sign-in isn’t configured yet — use a username + password for now.'
  }
  if (/already.*registered|email_exists/i.test(msg)) {
    return 'That email is already registered — sign in instead.'
  }
  if (/Email not confirmed/i.test(msg)) {
    return 'Confirm your email first — check your inbox for the link.'
  }
  // Server messages (username taken, invalid credentials, format) are already friendly.
  return msg
}

async function submit() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    if (mode.value === 'sign_in') {
      await signInIdentity(identity.value, password.value)
      open.value = false
    }
    else if (mode.value === 'sign_up') {
      await signUpUsername(username.value, email.value, password.value)
      sentKind.value = 'confirmation_sent'
      sentMsg.value = `Confirmation link sent to ${email.value}. Open it to finish creating your account.`
      sent.value = true
    }
    else {
      await resetIdentity(identity.value)
      sentKind.value = 'reset_sent'
      sentMsg.value = 'If that account exists, a reset link is on its way.'
      sent.value = true
    }
  }
  catch (e) {
    error.value = friendlyError(e)
  }
  finally {
    loading.value = false
  }
}

async function googleAction() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    // sign_up links Google to the current anon user (preserves history); sign_in switches.
    if (mode.value === 'sign_up') await linkGoogle()
    else await signInGoogle()
    // On success the browser redirects away; nothing more runs here.
  }
  catch (e) {
    error.value = friendlyError(e)
    loading.value = false
  }
}

// Reset transient state whenever the dialog closes.
watch(open, (isOpen) => {
  if (!isOpen) {
    identity.value = ''
    username.value = ''
    email.value = ''
    password.value = ''
    error.value = ''
    sent.value = false
    loading.value = false
    mode.value = 'sign_in'
  }
})
</script>

<style scoped>
.terminal {
  width: 100%;
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg);
  padding: 26px 26px 22px;
  box-shadow: var(--psy-shadow-md, 0 24px 60px rgba(0, 0, 0, 0.45));
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.terminal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
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

/* ── Tabs ───────────────────────────────────────────────────────────────── */
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 22px;
  border-bottom: 1px solid var(--psy-line);
}

.tab {
  background: transparent;
  border: none;
  padding: 10px 0 12px;
  font-family: var(--psy-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--psy-text-faint);
  cursor: pointer;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
}

.tab:hover { color: var(--psy-text-muted); }

.tab.active {
  color: var(--psy-text-highlighted);
  border-bottom-color: var(--psy-tan);
}

/* ── Form ───────────────────────────────────────────────────────────────── */
.form { margin-top: 22px; }

.field { margin-bottom: 16px; }

.field-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

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

.input::placeholder { color: var(--psy-text-faint); }
.input:focus { border-color: var(--psy-signal); box-shadow: 0 0 0 1px var(--psy-signal); }
.input:disabled { opacity: 0.6; }

.hint {
  margin-top: 6px;
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--psy-text-faint);
}

.error {
  margin: 4px 0 14px;
  font-family: var(--psy-font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--psy-locked);
}

/* ── Primary (access_session) — matches home begin_session signal CTA ──────── */
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

/* ── OR divider ─────────────────────────────────────────────────────────── */
.or {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0;
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--psy-text-faint);
}

.or::before, .or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--psy-line);
}

/* ── Google ─────────────────────────────────────────────────────────────── */
.google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: transparent;
  border: 1px solid var(--psy-line-strong);
  border-radius: 2px;
  padding: 12px;
  font-family: var(--psy-font-sans);
  font-size: 14px;
  font-weight: 600;
  color: var(--psy-text);
  cursor: pointer;
}

.google:hover:not(:disabled) { border-color: var(--psy-text-faint); background: color-mix(in srgb, var(--psy-bg-panel) 50%, transparent); }
.google:disabled { opacity: 0.6; cursor: default; }

.g-badge {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 2px;
}

/* ── Footer + links ─────────────────────────────────────────────────────── */
.foot {
  margin-top: 18px;
  text-align: center;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.03em;
  color: var(--psy-text-faint);
}

.link {
  background: transparent;
  border: none;
  padding: 0;
  font-family: var(--psy-font-mono);
  font-size: inherit;
  color: var(--psy-signal);
  cursor: pointer;
}

.link:hover { text-decoration: underline; }
.forgot { font-size: 11px; letter-spacing: 0.04em; }

/* ── Sent state ─────────────────────────────────────────────────────────── */
.sent { margin-top: 22px; }

.sent-msg {
  margin: 10px 0 18px;
  font-family: var(--psy-font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--psy-text-muted);
}
</style>
