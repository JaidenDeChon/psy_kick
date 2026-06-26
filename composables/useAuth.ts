import type { SupabaseClient, User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string | null
  isAnonymous: boolean
}

/** Map a Supabase user (or null) onto our minimal, serialisable footer/auth shape. */
export function toAuthUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null
  return { id: u.id, email: u.email ?? null, isAnonymous: !!u.is_anonymous }
}

/**
 * Auth surface for the UI. Wraps the lazily-created Supabase client (the homepage
 * stays Supabase-free — see plugins/supabase.client.ts) and exposes the upgrade /
 * sign-in / sign-out flows the access_terminal dialog needs.
 *
 * Source of truth for `user` is the plugin's onAuthStateChange listener; before
 * the client exists (e.g. a cold homepage load) `hydrateFromStorage()` seeds the
 * footer from the persisted session WITHOUT importing Supabase.
 */
export function useAuth() {
  const nuxtApp = useNuxtApp()
  const { apiFetch } = useApi()
  const user = useState<AuthUser | null>('authUser', () => null)
  const handle = useState<string>('userHandle', () => '')

  const isPermanent = computed(() => !!user.value && !user.value.isAnonymous)
  const isAnonymous = computed(() => !isPermanent.value)

  function getClient(): Promise<SupabaseClient> {
    const get = nuxtApp.$getSupabase as (() => Promise<SupabaseClient>) | undefined
    if (!get) return Promise.reject(new Error('[psy_kick] Supabase plugin unavailable'))
    return get()
  }

  function syncFrom(u: User | null | undefined) {
    user.value = toAuthUser(u)
  }

  /** Apply a new username to the footer + cold-load cache (after a profile edit). */
  function setHandle(next: string) {
    handle.value = next
    if (import.meta.client) {
      try { localStorage.setItem('psy_kick_handle', next) }
      catch { /* ignore */ }
    }
  }

  /** Seed footer state on the client without pulling in Supabase (homepage perf). */
  function hydrateFromStorage() {
    if (!import.meta.client || user.value) return
    try {
      const raw = localStorage.getItem('psy_kick_auth')
      if (!raw) return
      const token = JSON.parse(raw)?.access_token as string | undefined
      const payload = token?.split('.')[1]
      if (!payload) return
      const claims = JSON.parse(atob(payload))
      user.value = {
        id: claims.sub,
        email: claims.email ?? null,
        isAnonymous: claims.is_anonymous ?? false,
      }
      // Restore the cached username so the footer shows it immediately, rather
      // than flashing the email local-part until the lazy client loads the profile.
      const cachedHandle = localStorage.getItem('psy_kick_handle')
      if (cachedHandle) handle.value = cachedHandle
    }
    catch { /* malformed/absent session — stay anonymous */ }
  }

  const absoluteUrl = (path: string) =>
    import.meta.client ? `${window.location.origin}${path}` : undefined

  /**
   * sign_up: attach an email + password to the CURRENT anonymous session. Preserves
   * the uid (and thus all practice history). Returns still-anonymous until the user
   * confirms via the emailed link, so callers should surface a "check your email" state.
   */
  async function signUpUsername(username: string, email: string, password: string) {
    await getClient() // ensure an anon session exists so reserve-username is authenticated
    // Claim the public username first — fails fast (409) if taken, before touching email.
    await apiFetch('/api/auth/reserve-username', { method: 'POST', body: { username } })
    const sb = await getClient()
    // emailRedirectTo lands the confirmation on /auth/confirm — which initializes
    // the client and picks up the new session (the homepage is Supabase-free).
    const { data, error } = await sb.auth.updateUser(
      { email, password },
      { emailRedirectTo: absoluteUrl('/auth/confirm') },
    )
    if (error) throw error
    return data.user
  }

  /**
   * sign_in by username OR email. Resolution + password check happen server-side
   * (emails stay private); we then adopt the returned session, replacing the
   * throwaway anonymous one (§4).
   */
  async function signInIdentity(identity: string, password: string) {
    const sb = await getClient()
    const { tokens } = await apiFetch<{ tokens: { access_token: string; refresh_token: string } }>(
      '/api/auth/login',
      { method: 'POST', body: { identity, password } },
    )
    const { data, error } = await sb.auth.setSession(tokens)
    if (error) throw error
    syncFrom(data.user)
    return data.user
  }

  /** sign_in via Google (switch). Redirects away; resolves on /auth/confirm. */
  async function signInGoogle() {
    const sb = await getClient()
    await sb.auth.signOut()
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: absoluteUrl('/auth/confirm') },
    })
    if (error) throw error
  }

  /** sign_up via Google: link the identity to the current anon user (preserves uid). */
  async function linkGoogle() {
    const sb = await getClient()
    const { error } = await sb.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: absoluteUrl('/auth/confirm') },
    })
    if (error) throw error
  }

  async function resetIdentity(identity: string) {
    // Resolve username→email + send the reset link server-side (private, no enumeration).
    await apiFetch('/api/auth/reset', {
      method: 'POST',
      body: { identity, redirectTo: absoluteUrl('/auth/reset') },
    })
  }

  /** Used by the reset page once the recovery link has established a session. */
  async function setPassword(password: string) {
    const sb = await getClient()
    const { data, error } = await sb.auth.updateUser({ password })
    if (error) throw error
    syncFrom(data.user)
    return data.user
  }

  /** Sign out, then re-establish an anonymous session so the app keeps working. */
  async function signOut() {
    const sb = await getClient()
    await sb.auth.signOut()
    handle.value = ''
    if (import.meta.client) localStorage.removeItem('psy_kick_handle')
    const { data } = await sb.auth.signInAnonymously()
    syncFrom(data.user)
  }

  return {
    user, handle, isAnonymous, isPermanent,
    hydrateFromStorage, syncFrom, setHandle,
    signUpUsername, signInIdentity, signInGoogle, linkGoogle, resetIdentity, setPassword, signOut,
  }
}
