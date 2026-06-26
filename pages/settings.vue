<template>
  <section class="settings-screen">
    <div class="settings-head">
      <div class="screen-eyebrow">// account</div>
      <h1 class="screen-title">my_profile</h1>
    </div>

    <div v-if="loading" class="loading">loading_</div>

    <div v-else class="cards">
      <!-- ── identity ──────────────────────────────────────────────────────── -->
      <form class="card" @submit.prevent="saveUsername">
        <div class="card-head">
          <h2 class="card-title">identity</h2>
          <p class="card-desc">
            Your public username — the only thing other operators see. Your email stays private.
          </p>
        </div>

        <div class="card-body">
          <div class="field">
            <label class="micro" for="set-username">username</label>
            <input
              id="set-username"
              name="username"
              v-model.trim="username"
              class="input"
              type="text"
              autocomplete="username"
              pattern="[A-Za-z0-9_]+"
              minlength="3"
              maxlength="20"
              :disabled="savingName"
              required
            >
          </div>

          <div v-if="email" class="field">
            <label class="micro" for="set-email">email · private</label>
            <input id="set-email" class="input" type="email" :value="email" disabled>
          </div>
        </div>

        <div class="card-foot">
          <p v-if="nameMsg" class="msg" :class="nameOk ? 'msg--ok' : 'msg--err'">{{ nameMsg }}</p>
          <button class="primary" type="submit" :disabled="savingName || !nameChanged">
            {{ savingName ? '···' : 'update_username →' }}
          </button>
        </div>
      </form>

      <!-- ── security ──────────────────────────────────────────────────────── -->
      <form class="card" @submit.prevent="savePassword">
        <div class="card-head">
          <h2 class="card-title">security</h2>
          <p class="card-desc">
            {{ hasPassword
              ? 'Change the password you use to sign in.'
              : 'Set a password so you can also sign in without Google.' }}
          </p>
        </div>

        <div class="card-body">
          <div v-if="hasPassword" class="field">
            <label class="micro" for="pw-current">current_password</label>
            <input
              id="pw-current"
              name="current-password"
              v-model="currentPassword"
              class="input"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              :disabled="savingPw"
              required
            >
          </div>

          <div class="field">
            <label class="micro" for="pw-new">new_password</label>
            <input
              id="pw-new"
              name="new-password"
              v-model="newPassword"
              class="input"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              minlength="6"
              :disabled="savingPw"
              required
            >
          </div>

          <div class="field">
            <label class="micro" for="pw-confirm">confirm_password</label>
            <input
              id="pw-confirm"
              name="new-password"
              v-model="confirmPassword"
              class="input"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              minlength="6"
              :disabled="savingPw"
              required
            >
          </div>
        </div>

        <div class="card-foot">
          <p v-if="pwMsg" class="msg" :class="pwOk ? 'msg--ok' : 'msg--err'">{{ pwMsg }}</p>
          <button class="primary" type="submit" :disabled="savingPw">
            {{ savingPw ? '···' : (hasPassword ? 'update_password →' : 'set_password →') }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi()
const { setHandle } = useAuth()
const router = useRouter()

interface Me {
  handle: string
  email: string | null
  isAnonymous: boolean
  hasPassword: boolean
}

const loading = ref(true)
const email = ref<string | null>(null)
const hasPassword = ref(false)

// identity
const initialUsername = ref('')
const username = ref('')
const savingName = ref(false)
const nameMsg = ref('')
const nameOk = ref(false)

// security
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPw = ref(false)
const pwMsg = ref('')
const pwOk = ref(false)

const nameChanged = computed(() => username.value !== initialUsername.value && username.value.length >= 3)

function friendly(e: unknown, fallback: string): string {
  const err = e as { data?: { message?: string }; message?: string }
  return err?.data?.message ?? err?.message ?? fallback
}

onMounted(async () => {
  try {
    const me = await apiFetch<Me>('/api/profile/me')
    if (me.isAnonymous) { router.replace('/'); return } // settings is for permanent accounts only
    initialUsername.value = me.handle
    username.value = me.handle
    email.value = me.email
    hasPassword.value = me.hasPassword
  }
  catch {
    router.replace('/')
  }
  finally {
    loading.value = false
  }
})

async function saveUsername() {
  if (savingName.value || !nameChanged.value) return
  savingName.value = true
  nameMsg.value = ''
  try {
    const { handle } = await apiFetch<{ handle: string }>('/api/profile/username', {
      method: 'POST',
      body: { username: username.value },
    })
    setHandle(handle)
    initialUsername.value = handle
    nameOk.value = true
    nameMsg.value = 'username updated'
  }
  catch (e) {
    nameOk.value = false
    nameMsg.value = friendly(e, 'Could not update username.')
  }
  finally {
    savingName.value = false
  }
}

async function savePassword() {
  if (savingPw.value) return
  if (newPassword.value !== confirmPassword.value) {
    pwOk.value = false
    pwMsg.value = 'Passwords do not match.'
    return
  }
  savingPw.value = true
  pwMsg.value = ''
  try {
    await apiFetch('/api/profile/password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value || undefined, newPassword: newPassword.value },
    })
    const wasSet = hasPassword.value
    hasPassword.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    pwOk.value = true
    pwMsg.value = wasSet ? 'password updated' : 'password set — you can now sign in without Google'
  }
  catch (e) {
    pwOk.value = false
    pwMsg.value = friendly(e, 'Could not update password.')
  }
  finally {
    savingPw.value = false
  }
}
</script>

<style scoped>
.settings-screen {
  padding: clamp(40px, 6vw, 64px) clamp(22px, 6vw, 72px) clamp(48px, 7vw, 72px);
  max-width: 760px;
}

.screen-eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-bottom: 14px;
}

.screen-title {
  font-size: clamp(32px, 6vw, 46px);
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1;
  color: var(--psy-text-highlighted);
  margin: 0;
}

.loading {
  font-family: var(--psy-font-mono);
  color: var(--psy-text-faint);
  padding: 60px 0;
}

/* ── Cards ──────────────────────────────────────────────────────────────── */
.cards {
  margin-top: 36px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: var(--psy-bg-base);
  border: 1px solid var(--psy-line);
  border-radius: var(--psy-radius-lg, 4px);
  padding: 24px 26px;
}

.card-head { margin-bottom: 20px; }

.card-title {
  font-family: var(--psy-font-mono);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--psy-text-highlighted);
  margin: 0;
}

.card-desc {
  margin-top: 8px;
  font-family: var(--psy-font-sans);
  font-size: 13px;
  line-height: 1.6;
  color: var(--psy-text-muted);
  max-width: 52ch;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field { display: block; }

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

/* ── Footer (message + save) ────────────────────────────────────────────── */
.card-foot {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--psy-line);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.msg {
  margin: 0;
  margin-right: auto;
  font-family: var(--psy-font-mono);
  font-size: 12px;
  line-height: 1.5;
}

.msg--ok { color: var(--psy-signal); }
.msg--err { color: var(--psy-locked); }

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
  white-space: nowrap;
}

.primary:hover:not(:disabled) { background: var(--psy-signal-400, var(--psy-signal)); }
.primary:disabled { opacity: 0.5; cursor: default; }

@media (max-width: 520px) {
  .card-foot { flex-direction: column; align-items: stretch; }
  .msg { margin-right: 0; }
  .primary { width: 100%; }
}
</style>
