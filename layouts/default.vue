<template>
  <div class="app-shell" :class="{ 'nav-open': mobileOpen }">
    <!-- Mobile top bar — only shows below the sidebar breakpoint -->
    <header class="mobile-topbar">
      <NuxtLink to="/" class="topbar-logo">psy_kick<span class="blink-underscore">_</span></NuxtLink>
      <button class="topbar-menu" aria-label="Toggle navigation" @click="mobileOpen = !mobileOpen">
        <span v-if="!mobileOpen">≡</span>
        <span v-else>✕</span>
      </button>
    </header>

    <!-- Drawer backdrop (mobile) -->
    <div v-if="mobileOpen" class="nav-backdrop" @click="mobileOpen = false" />

    <!-- Sidebar -->
    <aside class="psy-sidebar">
      <div class="sidebar-brand">
        <NuxtLink to="/" class="sidebar-logo">psy_kick<span class="blink-underscore">_</span></NuxtLink>
        <div class="sidebar-eyebrow">remote_viewing_practice</div>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="sidebar-link"
          :class="{ 'sidebar-link--active': isLinkActive(link) }"
        >
          <span class="sidebar-glyph">{{ link.glyph }}</span>
          <span>{{ link.label }}</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <div class="footer-user">
          <div class="footer-avatar">y</div>
          <div class="footer-user-meta">
            <div class="footer-user-name">you</div>
            <div class="footer-user-sub">{{ userSub }}</div>
          </div>
        </div>
        <ClientOnly>
          <button class="footer-theme" @click="toggleTheme">{{ themeLabel }}</button>
          <template #fallback>
            <button class="footer-theme">◐ dark</button>
          </template>
        </ClientOnly>
      </div>
    </aside>

    <!-- Main — scrolls independently of the sidebar -->
    <main class="app-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()
const { apiFetch } = useApi()

const mobileOpen = ref(false)

const navLinks = [
  { to: '/',         label: 'home',    glyph: '⌂', match: ['/'] as string[], exact: true },
  { to: '/sessions', label: 'session', glyph: '◎', match: ['/sessions', '/session'] },
  { to: '/history',  label: 'history', glyph: '▤', match: ['/history'] },
  { to: '/stats',    label: 'stats',   glyph: '◴', match: ['/stats'] },
]

function isLinkActive(link: (typeof navLinks)[number]) {
  if (link.exact) return route.path === '/'
  return link.match.some(p => route.path.startsWith(p))
}

// Close the drawer whenever navigation happens.
watch(() => route.path, () => { mobileOpen.value = false })

// ── Theme toggle ────────────────────────────────────────────────────────────
const themeLabel = computed(() => (colorMode.value === 'dark' ? '◐ dark' : '○ light'))
function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// ── Sidebar sample count ────────────────────────────────────────────────────
// The home page is intentionally Supabase-free (it just paints). Anywhere else
// the client is loaded already, so we lazily fetch n once for the footer.
const sidebarN = useState<number | null>('sidebarN', () => null)
const userSub = computed(() =>
  sidebarN.value !== null ? `n=${sidebarN.value} · unranked` : 'unranked'
)

onMounted(async () => {
  if (route.path === '/' || sidebarN.value !== null) return
  try {
    const data = await apiFetch<{ stats: { n: number } }>('/api/stats')
    sidebarN.value = data.stats.n
  }
  catch { /* leave the footer at 'unranked' */ }
})
</script>

<style scoped>
/* ── Shell ──────────────────────────────────────────────────────────────── */
.app-shell {
  display: flex;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */
.psy-sidebar {
  width: 248px;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--psy-bg-base);
  border-right: 1px solid var(--psy-line);
  overflow-y: auto;
}

.sidebar-brand {
  padding: 26px 24px 30px;
}

.sidebar-logo {
  font-family: var(--psy-font-mono);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--psy-text);
  text-decoration: none;
}

.blink-underscore {
  color: var(--psy-signal);
  animation: psy-blink 1.15s step-end infinite;
}

.sidebar-eyebrow {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--psy-text-faint);
  margin-top: 7px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 14px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  text-align: left;
  padding: 11px 12px;
  font-family: var(--psy-font-sans);
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.01em;
  color: var(--psy-text-muted);
  text-decoration: none;
  border-radius: 2px;
  transition: background 0.1s, color 0.1s;
}

.sidebar-link:hover {
  background: color-mix(in srgb, var(--psy-bg-panel) 60%, transparent);
  color: var(--psy-text);
}

.sidebar-link--active {
  background: var(--psy-bg-panel);
  color: var(--psy-text-highlighted);
  box-shadow: inset 2px 0 0 var(--psy-tan);
  font-weight: 700;
}

.sidebar-glyph {
  width: 16px;
  display: inline-block;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-footer {
  margin-top: auto;
  padding: 18px 20px;
  border-top: 1px solid var(--psy-line);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.footer-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-avatar {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid var(--psy-line-strong);
  background: var(--psy-bg-panel);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--psy-font-mono);
  font-size: 12px;
  color: var(--psy-tan);
}

.footer-user-meta { line-height: 1.3; }

.footer-user-name {
  font-size: 13px;
  color: var(--psy-text);
}

.footer-user-sub {
  font-family: var(--psy-font-mono);
  font-size: 10px;
  color: var(--psy-text-faint);
}

.footer-theme {
  background: transparent;
  border: 1px solid var(--psy-line-strong);
  color: var(--psy-text-muted);
  padding: 8px 12px;
  font-family: var(--psy-font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  cursor: pointer;
  border-radius: 2px;
  text-align: left;
}

.footer-theme:hover { color: var(--psy-text); }

/* ── Main ───────────────────────────────────────────────────────────────── */
.app-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
}

/* ── Mobile top bar (hidden on desktop) ─────────────────────────────────── */
.mobile-topbar { display: none; }

.topbar-logo {
  font-family: var(--psy-font-mono);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--psy-text);
  text-decoration: none;
}

.topbar-menu {
  background: transparent;
  border: 1px solid var(--psy-line-strong);
  color: var(--psy-text);
  width: 38px;
  height: 38px;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-backdrop { display: none; }

/* ── Responsive: collapse the sidebar into a drawer ─────────────────────── */
@media (max-width: 880px) {
  .app-shell {
    flex-direction: column;
  }

  .mobile-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    height: 54px;
    padding: 0 18px;
    background: var(--psy-bg-base);
    border-bottom: 1px solid var(--psy-line);
    z-index: 30;
  }

  .nav-backdrop {
    display: block;
    position: fixed;
    inset: 54px 0 0 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 40;
  }

  .psy-sidebar {
    position: fixed;
    top: 54px;
    left: 0;
    bottom: 0;
    height: auto;
    width: 270px;
    max-width: 84vw;
    transform: translateX(-100%);
    transition: transform 0.18s ease;
    z-index: 50;
  }

  .app-shell.nav-open .psy-sidebar {
    transform: translateX(0);
  }

  /* The logo/brand is already in the top bar on mobile. */
  .sidebar-brand { display: none; }
  .sidebar-nav { padding-top: 16px; }

  .app-main {
    flex: 1;
    height: auto;
    min-height: 0;
    overflow-x: hidden;
  }
}
</style>
