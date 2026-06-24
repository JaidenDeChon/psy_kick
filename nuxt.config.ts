export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/fonts',
    // Inline module (runs AFTER @nuxt/ui): NuxtUI pushes 'reka-ui' into
    // build.transpile, which excludes it from Vite's dep pre-bundler and forces
    // it to be served as ~540 separate modules in dev. Removing it lets the
    // optimizeDeps.include below pre-bundle reka-ui into a single file.
    (_inlineOptions, nuxt) => {
      nuxt.options.build.transpile = nuxt.options.build.transpile.filter(
        t => t !== 'reka-ui'
      )
    },
  ],
  css: ['~/assets/css/main.css'],
  ssr: true,
  devtools: { enabled: true },

  fonts: {
    families: [
      { name: 'Lato', provider: 'google', weights: [300, 400, 700, 900], styles: ['normal'] },
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500, 600], styles: ['normal'] },
    ],
  },

  colorMode: {
    preference: 'system',
    classSuffix: '',
  },

  runtimeConfig: {
    supabaseServiceKey: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
    },
  },

  nitro: {
    preset: 'netlify',
  },

  vite: {
    // Force Vite to pre-bundle these in dev. Without this, NuxtUI's headless
    // dependency `reka-ui` is served as ~540 separate unbundled ES modules,
    // creating a multi-second request waterfall before the page can hydrate.
    // Pre-bundling collapses each into a single optimized file.
    optimizeDeps: {
      include: [
        'reka-ui',
        'reka-ui/namespaced',
        '@internationalized/date',
        '@internationalized/number',
        'tailwind-variants',
        '@tanstack/vue-virtual',
      ],
      // Supabase is lazy/dynamic-imported (off the homepage critical path). Don't
      // let Vite pre-bundle it: its scanner drags in optional React-Native/ws/
      // opentelemetry platform deps that don't exist in the browser and spam
      // "incompatible with the dep optimizer" warnings. Excluded → served as
      // native ESM on demand the first time /sessions loads.
      exclude: [
        '@supabase/supabase-js',
        '@supabase/auth-js',
        '@supabase/postgrest-js',
        '@supabase/realtime-js',
        '@supabase/storage-js',
        '@supabase/functions-js',
      ],
    },
  },

  compatibilityDate: '2025-11-01',
})
