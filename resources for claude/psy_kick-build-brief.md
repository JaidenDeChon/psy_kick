# psy_kick — Build Brief

### v1 scope: the single blind session loop, end to end

> **What this document is.** This is the *build brief* — the second of a two-document pair. The
> *design brief* already went to Claude Design and produced `design_handoff_psy_kick/` (README,
> tokens, `.dc.html` previews). **This brief is the input to plan-first / Superplan mode:** a planner
> (Opus or Fable) turns it into an implementation plan, then an implementer (Sonnet) builds from that
> plan plus the design handoff. It is written so **the planner re-derives nothing and the implementer
> makes no independent product/architecture decisions** — every such decision lives here or is
> explicitly flagged `[NEEDS: …]`.

---

## 0 · How to use this brief — and the standing guardrails

**Read these first; they govern everything below.**

1. **Never fabricate facts, values, or assets.** If a value, credential, or asset isn't known, write
   `[NEEDS: …]` and **stop on that point** — do not invent a plausible-looking value, URL, key, or
   image. This is a hard rule, inherited from the project.
2. **Ask on any uncertainty, ambiguity, or contradiction.** If something in this brief, the design
   handoff, the project instructions, or the *actual* behavior of Nuxt / NuxtUI / Supabase / Netlify
   as you encounter it is unclear or appears to conflict — **raise it with the owner before
   proceeding. Do not guess, and do not silently paper over it.** A short, specific question is always
   preferable to a confident wrong assumption. This applies to both the planning pass and the build.
3. **No framework port.** Everything in `design_handoff_psy_kick/` — the `.dc.html` files especially —
   is **look-and-feel reference only**. It is plain HTML/CSS so it opens in a browser; it is *not*
   implementation to translate. Build fresh in Nuxt/Vue/NuxtUI from the spec. There is no React in the
   handoff and none should be produced. If a framework-shaped preview ever appears, ignore its code.
4. **Bun only.** All package management and scripts use **Bun** — never npm, pnpm, or yarn. *If you
   start typing `npm`, stop and use Bun.*
5. **Plan first, build second.** The planner produces the plan and waits for the owner's sign-off
   before any code is written.

**Authoritative sources, in order (do not contradict a higher one without flagging it):**

| Source | Role |
|---|---|
| This build brief | Product, data, and architecture decisions. The spec to build. |
| `design_handoff_psy_kick/README.md` | Design source of truth: tokens, components, states, motion, copy. |
| `psy_kick_tokens.css` | Every token as CSS custom properties + the NuxtUI `--ui-*` alias layer. |
| `screens.dc.html` | Visual reference for all 7 loop states + history, stats/leaderboard, judge. |
| `drawing_canvas.dc.html` | The one custom component (`sketch_canvas`) + its empty/drawing/locked states. |
| `psy_kick-design-brief.md` | Original product/visual intent (background; superseded by the handoff where they differ). |

The `[NEEDS: …]` convention is for the *implementer to surface to the owner*, not to fill in silently.
A consolidated list of every open item appears in **§13**.

---

## 1 · The product in one screen

A practice app for **Controlled Remote Viewing (CRV)**. v1 does exactly one thing: **run a single
honest blind session, end to end.**

The load-bearing principle — and the thing the whole build must protect — is that **rigor is what
makes a session meaningful.** Blind targets, structured capture, and decoy scoring are not bureaucracy
around a mystical experience; they are the only reason a real signal can show up instead of drowning
in "I drew some curves and there are curves in the photo." Three of these guarantees are *enforced by
the server and the database*, not merely by the UI — that is the core engineering job.

**The loop (this sequence *is* the product):**

```
1 ready  →  2 cool-down  →  3 capture  →  4 lock  →  5 reveal  →  6 judge  →  7 result
```

The visual design of every screen is **already specified in the handoff** — do not re-specify it.
This brief covers the architecture, data, integrity enforcement, scoring, the one custom component,
and how to wire the design system in. The screen ↔ state ↔ real-label mapping is in **§9**.

---

## 2 · Stack & tooling

| Concern | Decision |
|---|---|
| Package manager / scripts | **Bun, exclusively.** `bun install`, `bun run …`. Never npm/pnpm/yarn. |
| Framework | **Nuxt (latest stable major)**, **Vue**, **SSR enabled** (Nitro server). |
| Design system | **NuxtUI** (v4 token model — see §9). Custom components only where noted (one: `sketch_canvas`). |
| Backend / data | **Supabase** — Postgres + Auth + Storage + Row-Level Security. |
| Hosting | **Netlify**, **GitHub auto-deploy on `main`**. |
| Node version | **Do not pin Node.** Use current best practice for the chosen Nuxt major on Netlify (the platform default / Nuxt's recommended runtime). |
| Dark mode | **Required, defaults to the device setting** (NuxtUI `colorMode`). Dark is the hero register; light is a fully-finished equal. Both ship. |
| Fonts | **Lato** (voice) + **IBM Plex Mono** (data). Both are OFL / legally shippable. **Self-host/bundle** them (e.g. via the Nuxt fonts module or a local font package) rather than relying on a third-party CDN at runtime — OFL permits bundling, and it keeps shipping legal and load deterministic. No login-walled foundries. |

**Flag the owner if a new Nuxt major has shipped** since this brief was written (project standing rule)
— surface it before adopting or skipping it, rather than silently choosing.

**Bun on Netlify / SSR deploy:** use Bun as the package manager and the Nitro **Netlify preset** for
the SSR target, with GitHub auto-deploy on `main`. The *exact* current wiring (build command, preset
name, any adapter package) should be confirmed against the current Netlify + Nuxt docs at build time —
**if any detail is ambiguous or the docs have changed, ask rather than guess** (per §0.2). Do not
fabricate config you are unsure of.

---

## 3 · Architecture overview

A Nuxt SSR application backed by Supabase, deployed on Netlify.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Browser (Vue / NuxtUI)                                                    │
│   • Renders the 7-state loop + history/stats.                              │
│   • Holds ONLY the reference number during capture. NEVER the target image │
│     path or decoy identities pre-lock.                                     │
│   • Talks to the server through typed Nitro routes for every gated action. │
└───────────────▲───────────────────────────────────────────────┬──────────┘
                │ SSR HTML + hydration payload                    │ fetch() to /api/*
                │ (must contain NO target image path pre-lock)    │
┌───────────────┴───────────────────────────────────────────────▼──────────┐
│  Nitro server (the trust boundary)                                         │
│   • /api/session/* routes enforce: blinding, irreversible lock, reveal     │
│     gate, server-side scoring. These are the integrity guarantees.         │
│   • Uses the Supabase SERVICE ROLE for gated reads (target/decoy paths,    │
│     scoring) so the client can never read them directly.                   │
└───────────────────────────────────┬───────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼──────────────────────────────────────┐
│  Supabase                                                                  │
│   • Postgres + Row-Level Security (every row user-scoped by auth.uid()).   │
│   • Auth: anonymous sessions for v1 (account upgrade later).               │
│   • Storage: curated target/decoy images, served ONLY via short-lived      │
│     signed URLs minted server-side AFTER lock.                             │
└────────────────────────────────────────────────────────────────────────────┘
```

**The one principle that drives the architecture:** the client is never trusted with anything that
could de-blind a session. Every integrity-critical operation — selecting the target, minting the
reference, locking, revealing, scoring — runs on the server. The client receives only what it is
allowed to see at the moment it is allowed to see it.

---

## 4 · Server-enforced blinding (the crown jewel)

**Requirement:** the target image must NEVER reach the client before the session is locked — not even
preloaded and hidden. Store a target *ID*; serve the image *URL* only via a separate request *after*
lock.

### Mechanism, step by step

1. **On begin (server):** select a target + 3 decoys, mint an opaque **reference number**, insert the
   `sessions` row (with `target_id`) and the 4 `session_candidates` rows. **Return to the client only**
   `{ session_id, reference_number }`. The `target_id`, the candidate image paths, and which candidate
   is the target are **not** in the response, **not** in any SSR payload, and **not** in hydration
   state.
2. **During capture (client):** the client holds the reference number and nothing image-derived. There
   is **no `<img>`, no `<link rel=preload/prefetch>`, no background-image, and no fetch** that resolves
   a target or decoy image. The capture route must **not** SSR-load the target via `useAsyncData` /
   payload — sensitive data is fetched through gated `/api/*` routes only, and only post-lock.
3. **On lock (server):** validate the session is owned by the caller and currently unlocked; set
   `locked_at`. **Irreversible** (see §5). Capture data becomes read-only.
4. **On reveal (server):** verify `locked_at` is set; only then mint a **short-lived signed URL** for
   the target image (Supabase Storage signed URL, suggested TTL ≈ 60s, tunable) and set `revealed_at`.
   The image is fetched client-side **only at this point**.
5. **On judge (server):** post-lock, return the 4 candidate signed URLs in **randomized slot order**
   with **`is_target` withheld**. The mapping from slot → real image (and which is the target) stays
   server-side until the ranking is submitted and scored.

### Leakage-prevention checklist (the implementer must verify each)

- [ ] No target/decoy image path in any begin/capture response, SSR HTML, or Nuxt hydration payload.
- [ ] No `<img>`, `preload`, `prefetch`, or background-image referencing a target/decoy pre-lock.
- [ ] Signed URLs are minted **only** by the reveal/judge routes, **only** after `locked_at` is set.
- [ ] RLS prevents the client from reading `sessions.target_id`, `session_candidates.is_target`, or
      image paths before lock. Gated reads go through Nitro using the service role — never a direct
      client query.
- [ ] The reveal route is **idempotent** and re-checks `locked_at` server-side on every call.
- [ ] Decoy identities also stay server-side until judge (they don't reveal the target, but there is
      no reason to ship them earlier).

> **Acceptance test for blinding:** with dev tools open, complete a capture up to (but not through)
> lock; inspect every network response, the SSR HTML, and `window.__NUXT__`. **No target or decoy
> image URL may appear anywhere** until the lock + reveal calls fire.

---

## 5 · Irreversible lock

**Requirement:** once a session is locked/revealed, **all drawings and notes are permanently
read-only.** Lock is a deliberate, weighty commit (design frame 04: a mandatory confirm modal —
`cancel — keep working` / `▩ lock & reveal`).

Enforced at **two** layers, not one:

- **Database:** once `sessions.locked_at` is non-null, **no update to that session's impressions is
  permitted.** Enforce via RLS policy and/or a row trigger that rejects writes to
  `session_perceptions`, `session_aol`, `sessions.notes`, and the strokes when `locked_at IS NOT NULL`.
  `locked_at` itself can only transition `NULL → timestamp`, never back. The lock cannot be reverted
  by any client call.
- **UI:** the `sketch_canvas` enters its `locked` state — render `stroke[]` to a flat read-only layer
  and **unmount the toolbar entirely**; no edit affordance survives (§8). Inputs render as static text.

Locking **triggers reveal** (per the loop). Draft autosave is allowed **only while unlocked**.

---

## 6 · Data model (Supabase / Postgres)

Concrete tables below. All tables are **user-scoped via RLS** by `auth.uid()` unless noted. Column
shapes are the recommended default; **if the planner believes a different shape serves the integrity
rules better, propose it and flag — do not silently diverge** (§0.2). Sensitive columns are marked
🔒 (server-only; never client-readable, even with a valid session, until the gate opens).

### `profiles`
1:1 with `auth.users`. Created on first session (anonymous users included).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id`. |
| `handle` | text | Display name (e.g. `m_okafor`). For anonymous users, auto-generate a readable handle. `[NEEDS: handle-generation scheme — default-and-flagged in §13]` |
| `created_at` | timestamptz | default now(). |

Forward-compat: when account upgrade ships, an anonymous `auth.users` row is linked to an email
identity; `profiles.id` is unchanged, so history/stats carry over.

### `targets`
The curated image pool. **Every image can serve as a target *or* a decoy** — there is no separate
decoy table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `storage_path` | text 🔒 | Path in Supabase Storage. Never client-readable except via a post-lock signed URL. |
| `category` | enum 🔒 | Controlled vocabulary aligned to gestalt: `land / water / structure / motion / life / energy`. Drives decoy orthogonality. |
| `attributes` | text[] 🔒 | Optional finer visual tags for orthogonality (e.g. `indoor`, `has_figure`, `color_dominant`). Extensible. |
| `caption` | text | Optional, shown only post-reveal. |
| `license` | text | Per-image license / attribution. **Must be legally shippable** (see §10). |
| `active` | boolean | Only `active` images enter selection. |
| `created_at` | timestamptz | |

### `sessions`
Lifecycle + the blind reference. One per attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | The viewer (creator). |
| `target_id` | uuid FK → targets 🔒 | The sealed target. Never client-readable pre-lock. |
| `reference_number` | text | The opaque blind pointer, e.g. `8302—517`. Display token (§9). |
| `status` | enum | `capturing → locked → revealed → judged` (derive from timestamps if preferred). |
| `notes` | text | Freeform catch-all — a *neutral* field, categorically **not** perception and **not** AOL. Read-only after lock. |
| `created_at` | timestamptz | |
| `locked_at` | timestamptz null | Non-null = irreversibly locked. |
| `revealed_at` | timestamptz null | Set by the reveal route. |
| `judged_at` | timestamptz null | Set by the judge route. |

### `session_candidates`
The 4 candidates (1 target + 3 decoys) for a session, plus the recorded ranking.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → sessions | |
| `image_id` | uuid FK → targets | One of the 4 images. |
| `is_target` | boolean 🔒 | True for exactly one row. Withheld from the client until scoring. |
| `slot` | int | Randomized presentation order at judge time. |
| `judged_rank` | int null | 1–4, filled at judge. |

### Impressions — the signal/noise split is **structural, not just visual**

The integrity rule *"keep perceptions and AOL separate — raw sensory data is categorically distinct,
in both data and UI, from analytic-overlay guesses"* is enforced by storing them in **separate
tables**. They are never co-mingled in one free-text blob.

**`session_perceptions` — THE SIGNAL** (one row per session)

| Column | Type | Notes |
|---|---|---|
| `session_id` | uuid PK/FK | |
| `gestalt_tags` | text[] | From `land / water / structure / motion / life / energy`. |
| `sensory` | jsonb | The **separated** sensory fields: `{ color, texture, temp, sound, smell, taste }`. Stored as distinct keys — never one blob. |
| `dimensional_tags` | text[] | Controlled set, e.g. `tall / short / wide / narrow / open / enclosed / flat / deep` (extensible — flag additions). |
| `ideogram` | jsonb | `stroke[]` from the small ideogram canvas (§8). |
| `sketch` | jsonb | `stroke[]` from the main sketch canvas (§8). |

**`session_aol` — THE NOISE** (separate table; the analytic overlay to set aside)

| Column | Type | Notes |
|---|---|---|
| `session_id` | uuid PK/FK | |
| `entries` | jsonb | Ordered list of analytic-overlay dumps (e.g. `["feels like a lighthouse on a cliff"]`). A *distinct* store from perceptions — this separation is the point. |

> A single-table variant is acceptable **only if** perceptions and AOL remain distinct,
> non-co-mingled column groups (e.g. a clearly-separated `aol` jsonb that is never merged into the
> sensory blob). The separate-table form is the default because it makes the rule impossible to
> violate by accident. `[default-and-flagged — §13]`

**`session_attachments` — `[PLANNED, NOT v1]`**

Reserved so the future feature is **additive**, not a rewrite. Do **not** build it now; do **not**
model anything that blocks it. (See §12 for the planned hand-drawn-note upload + QR flow.)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → sessions | |
| `storage_path` | text | Uploaded hand-drawn note (raster). |
| `kind` | text | e.g. `scanned_note`. |
| `uploaded_at` | timestamptz | |

### `judgements`
One ranking event per session. **`judger_id` may differ from `sessions.user_id`** — this is what makes
friend-judging work later (the schema supports it now; the UI is fast-follow, §12).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → sessions | |
| `judger_id` | uuid FK → profiles | The person who ranked. May ≠ viewer. |
| `ranking` | jsonb | `{ candidate_id → rank }`. |
| `hit` | boolean | True iff the true target was ranked #1. **Computed server-side.** |
| `created_at` | timestamptz | |

### Stats
Per-user running stats are **derived server-side** from `judgements` (a SQL view or a Nitro
computation) — `hit_rate`, `n`, the Wilson interval, and the binomial p-value (§7). **Never computed
on the client.** Persisting a denormalized score row is optional; if added, the server is the only
writer.

### RLS / gating summary
- Every table: rows visible only to their owner (`user_id` / `judger_id` = `auth.uid()`), except
  curated `targets` metadata needed pre-lock (which excludes 🔒 columns).
- 🔒 columns (`target_id`, `storage_path`, `is_target`, target `category`/`attributes`) are **never**
  exposed to the client pre-gate. Reads that need them go through Nitro using the **service role**.
- Writes to impressions are rejected when `sessions.locked_at IS NOT NULL` (§5).

---

## 7 · Session lifecycle + decoy judging + scoring

### State machine — what the client sees, what the server does, what persists

| State | Client | Server route | DB writes | Persists |
|---|---|---|---|---|
| **ready** | Calm entry; `begin_session →`. | — | — | — |
| → begin | — | `POST /api/session/begin` | insert `sessions` (+ `target_id` 🔒), select target + 3 decoys, insert 4 `session_candidates`, mint `reference_number` | session + candidates |
| **cool-down** | Breathing orb; reference token shown; `enter_capture →`. | — (pure UI) | — | — |
| **capture** | Reference token + stage stepper; perceptions / AOL / notes / two canvases. Autosave (debounced) **while unlocked only**. | `PATCH /api/session/:id/impressions` | upsert `session_perceptions`, `session_aol`, `sessions.notes` | impressions (incremental drafts) |
| **lock** | Mandatory confirm modal (`cancel — keep working` / `▩ lock & reveal`). | `POST /api/session/:id/lock` | set `locked_at` (irreversible); impressions become read-only | lock state |
| **reveal** | Mono pointer flares → target image crossfades in (`reveal_target`). | `POST /api/session/:id/reveal` | verify `locked_at`; mint target signed URL; set `revealed_at` | reveal timestamp |
| **judge** | 4 candidates in randomized order, no target marker; rank `#1–#4`; `submit_ranking →`. | `GET /api/session/:id/candidates` → ranking → `POST /api/session/:id/judge` | read candidate signed URLs (slots, no `is_target`); on submit: write `judgements`, compute `hit`, set `judged_at`, write `session_candidates.judged_rank` | judgement + ranks |
| **result** | `HIT.` / miss, `your_sketch` vs `target` side-by-side, running stats; `save_to_history →`. | `GET /api/session/:id/result` | (read; optional denormalized score) | (already persisted) |

`save_to_history` is effectively a no-op write — the record already exists; the button completes the
loop and returns the user to history.

### Decoy judging + scoring logic (concrete)

- **Candidates:** exactly 4 = 1 target + 3 decoys, presented in **randomized slot order** with the
  target **unmarked**. The judger assigns a full ranking 1–4 (design uses rank chips `#1…#4`).
- **Hit:** the true target ranked **#1**. **Chance = 25%** by construction. Computed and stored
  server-side (`judgements.hit`). Never a vibe-based "did I get it?".
- **Running stats over the user's judged sessions** (all server-side):
  - `hit_rate = hits / n`.
  - **Baseline** drawn at **25%** (always shown).
  - **Wilson score interval (95%)** on `hit_rate` — chosen over the normal-approx z because it behaves
    honestly at the small *n* this app lives in (it stays wide, which *is* the honest message):

    ```
    z = 1.96
    center = (p̂ + z²/(2n)) / (1 + z²/n)
    margin = (z / (1 + z²/n)) · sqrt( p̂(1−p̂)/n + z²/(4n²) )
    lower  = clamp(center − margin, 0, 1)
    upper  = clamp(center + margin, 0, 1)
    ```

  - **One-sided binomial p-value** vs the chance null `p₀ = 0.25` — the probability of getting *at
    least* the observed hits by luck alone if the practitioner had no ability:

    ```
    p = Σ_{k = hits}^{n}  C(n, k) · 0.25^k · 0.75^(n−k)
    ```

    For small *n*, `p` stays large — this is correct and honest, not a bug.

### Honest-display requirements (mirror the design)

- **Always** show `n` and the 25% baseline next to every rate (frames 07 + 09). The handoff already
  encodes `sample · too_small_to_trust`, the dashed 25% line, and the `~30+ sessions` cue — keep them.
- **The p-value is displayed, set slightly apart from the hit rate per the design system** (its own
  treatment — mono, in a more reserved register so it reads as an advanced statistic, not the headline
  number).
- **Both** the Wilson interval and the binomial p-value are surfaced (the owner explicitly asked for
  the p-value; the Wilson band is retained as the primary small-*n* honesty cue). `[default-and-flagged
  — §13: trim to p-value only if the owner prefers]`
- **An info affordance** — a small **"i" / `ⓘ` button** (a ghost `UButton` or `UTooltip` trigger)
  sits beside the stat block and opens a **`UModal`** (suggested title `what_these_mean`) that, in
  plain language **with a small inline example UI**, defines: `hit_rate`, `n` / sample size, the 25%
  baseline, the Wilson interval, and the p-value. This is the one stats component the handoff doesn't
  already draw — build it consistent with §5's `UAlert`/`UTooltip` "teach, don't nag" posture.

### Viewer ≠ judger

`judgements.judger_id` may differ from `sessions.user_id`. In v1 the judger is the current user; the
schema and the judge screen (which shows only `recorded_impressions` + four images, assuming nothing
about who is judging) are built so a **friend can judge later** via a shareable judge link (§12) with
**no rework**.

---

## 8 · The one custom component — `sketch_canvas`

The only non-NuxtUI piece. Reference: `drawing_canvas.dc.html` (**look-and-feel only — rebuild in Vue,
do not port**). Keep it deliberate: it serves the protocol, not a full illustration app.

- **Tools:** pen, eraser, undo, clear, **two stroke widths** (thin ≈ 2.5, thick ≈ 6). Active tool =
  signal outline.
- **Input:** unified **pointer events** (mouse + touch + pen). People draw on phones —
  `touch-action: none` on the canvas; use `getCoalescedEvents()` for smooth high-frequency strokes.
- **Model (persistable):** `stroke = { mode: 'pen' | 'erase', width: number, points: [x, y][] }`; the
  whole sketch is `stroke[]`. Serialised to `session_perceptions.sketch` / `.ideogram` (jsonb).
  **Store coordinates normalized to `0–1`** (plus the reference aspect ratio / box), **not raw
  pixels**, so the same `stroke[]` re-renders correctly at any size — capture, history thumbnails,
  judge panel, and the result side-by-side all reuse it across devices.
- **Eraser:** render an `erase`-mode stroke as a destructive composite over prior strokes on the flat
  canvas (matches the preview's behavior). It is persisted as an `erase`-mode stroke, not as vector
  subtraction. `[default-and-flagged — §13: switch to true vector erase only if the owner wants it]`
- **States:**
  - `empty` — placeholder hint, tools enabled.
  - `drawing` — strokes render live.
  - `locked` — render `stroke[]` to a **flat read-only layer** and **unmount the toolbar entirely**.
    No edit affordance survives the lock (§5).
- **Two instances on capture:** a small **ideogram** field and the main **sketch** surface — same
  component, different size/props.
- **Forward-compat:** the future hand-drawn-note upload (§12) will add a *raster attachment* alongside
  the vector strokes. The canvas model and the session schema must not assume strokes are the only
  source of a sketch. `[PLANNED, NOT v1.]`

---

## 9 · Design-system integration (build fresh, no port)

**Wire the token layer, then build against NuxtUI primitives.** Do not translate any preview markup.

### Token wiring
- Drop **`psy_kick_tokens.css`** into `main.css`.
- Map the scales (the real theming knob — NuxtUI v4 derives semantics from them) via `@theme` /
  `app.config.ts`:
  - tan scale → `--ui-color-primary-*`
  - warm-gray scale → `--ui-color-neutral-*`
  - `--ui-font-sans` = Lato, `--ui-font-mono` = IBM Plex Mono
  - `--ui-radius: 2px` (call **D** — base float; components derive corners via
    `calc(var(--ui-radius) * 1.5 / 2 / 2.5 / 3)`)
- Keep the **explicit semantic overrides** the token file pins (`--ui-bg` = paper/void,
  `--ui-bg-elevated`, `--ui-bg-accented`, borders, bone body text) — they guarantee the manila look
  regardless of ramp drift.
- Use the **v4 semantic names verbatim**: note `--ui-bg-elevated` / `--ui-bg-accented` (**there is no
  `--ui-bg-muted`**), plus `--ui-text-toned` / `--ui-text-highlighted` / `--ui-*-inverted`.
- **Signal stays bespoke** (`--psy-signal*`) and is **never** `--ui-primary` (call **C**) — so NuxtUI
  can never spray electric blue onto a default component. Tan (`--ui-primary`) drives everyday UI;
  signal means *perception breaks through* and is rationed.

### Component inventory → NuxtUI (from the handoff)

| Need | NuxtUI | psy_kick notes |
|---|---|---|
| begin / lock / judge / save | `UButton` | primary = tan. Lock confirm button uses `--psy-locked` red. |
| session entry, stat card, leaderboard row | `UCard` | 1px line, 2px radius, panel bg. |
| lock confirm / reveal / judging | `UModal` / `USlideover` | lock modal = weighty, two buttons (`cancel — keep working` / `▩ lock & reveal`). |
| CRV stage progression | `UStepper` (or tabs) | 3 stages; active = signal dot + glow. Encodes the real method order. |
| sensory fields, notes | `UInput` / `UTextarea` / `UFormField` / `UForm` | inset bg, mono micro-labels. |
| gestalt / dimensional tags | `UBadge` / `UChip` | selected = tan border + text; idle = line border, muted. |
| reference number, Locked state | `UBadge` / `UChip` | mono coordinate token; Locked = red sealed chip. |
| cool-down + stage progress | `UProgress` | cool-down pairs with the breathing orb (custom motion). |
| history / leaderboard | `UTable` or card list | `UAvatar` for friends later. |
| blinding / AOL explainers | `UAlert` / `UTooltip` | teach, don't nag. |
| **stats "i" definitions dialog** | `UModal` + `UButton`/`UTooltip` | *new in this brief* (§7) — defines the displayed stats with an example. |
| **sketch + ideogram canvas** | **custom** | the only non-primitive (§8). |

### Screen ↔ state ↔ real-label map (use these exact labels)

| Frame | State | Verbatim labels / copy to use |
|---|---|---|
| 01 | ready | wordmark `psy_kick_` (signal cursor on `_`); `begin_session →`; footer `last · 7411—092 · miss · N sessions`. |
| 02 | cool-down | `TARGET 8302—517`; breathing orb; `breathe. settle.`; `enter_capture →`. |
| 03 | capture | header reference token + **stage stepper** ●●○ (active = signal dot + glow); panel `perceptions · the_signal` / `stages 1–3`, **top border 2px signal**; `ideogram_`; `gestalt_` chips; `sensory_` separated grid (`color/texture/temp/sound/smell/taste`); `dimensional_` chips; `sketch_canvas · custom_component`; AOL block `aol_log · set_aside` (**dashed, muted, italic**); `notes_`; `▩ lock_session`. |
| 04 | lock | `▩ lock` `irreversible`; "Lock this session?"; `sealing · 8302—517 · 12 fields · 1 sketch`; `cancel — keep working` / `▩ lock & reveal`. |
| 05 | reveal | `// signal_resolves`; mono pointer → `[ target_image ]` crossfade + inner signal glow; reduced-motion = clean crossfade, no flash; `reveal_target` / `reset_pointer`. |
| 06 | judge | "Which best matches the impressions?"; `chance = 25%`; `recorded_impressions` panel (sketch + gestalt/color/texture/dims); `candidate_a…d` with rank chips `#1…#4` (true target #1 = signal-bordered); `submit_ranking →`. |
| 07 | result | `8302—517 · ranked #1`; `HIT.` (`--psy-hit`) / miss; rank `1/4` badge; `your_sketch` vs `target` (signal-bordered, glow); `running · vs_chance`; `n = N sessions`; 25% line; `save_to_history →`. |
| 08 | history | "sessions" / `N records`; rows = thumbnail + `8302—517` / `jun 23 · water · slate` + `HIT · #1` (green) or `miss · #3` (muted). |
| 09 | stats | big `hit_rate`; `n = N` / `sample · too_small_to_trust`; chart `cumulative_rate vs 25% baseline` (dashed tan 25% line); `~30+ sessions` cue; **leaderboard quiet, `sustained_only (n ≥ 20)`**, `you · n=N · unranked · keep going`. |
| 10 | — | light-mode parity (fully-finished equal; tan + signal deepen for contrast on paper). |

### Motion — exactly two moments (honor `prefers-reduced-motion` in both)
- **cool-down:** slow **breathing orb** (`psy-breath` ≈ 4.6s, `psy-ring` halos) — a held breath, not a
  spinner. Reduced-motion: static glowing orb.
- **reveal:** the blind mono reference **flares**, then the target image settles (mono → image
  crossfade + brief inner signal glow). The signature moment. Reduced-motion: clean crossfade, no
  flash. Keyframes (`psy-blink`, `psy-breath`, `psy-ring`) are in the token file, gated behind the
  reduced-motion query.

### The signal-glow utility — the *only* effect
`.psy-glow` / `.psy-glow-text` are used **only** on: the live/recording dot, the cool-down orb, the
active stage marker, and the reveal burst. **Nowhere else.** Scarcity (plus the manila warmth on every
surface) is what keeps the look from collapsing into the stock hacker-terminal / crypto-dashboard
register.

---

## 10 · Target & decoy curation

**The owner will supply the curated images.** This brief provides the **curation protocol + the seed
contract** to curate against — it does **not** invent or claim any specific images or URLs.

### Why curated (not Unsplash-at-runtime)
Runtime-random selection cannot guarantee the target and its 3 decoys are visually distinct, which is
exactly what honest decoy scoring depends on (two "water" photos silently breaks the 25% premise). A
curated, **category-tagged** pool in Supabase Storage also makes blinding clean: the client gets a
`target_id`; the image URL is a short-lived signed URL minted only post-lock (§4).

### Curation protocol (the rules the owner curates to)
1. **Controlled category vocabulary**, aligned to gestalt: `land / water / structure / motion / life /
   energy`. Every image is tagged with exactly one primary category (optionally finer `attributes`).
2. **Orthogonality rule (enforced at selection):** a session's target + 3 decoys must span **distinct
   categories** and be visually dissimilar. The selection logic picks 3 decoys from categories *other
   than* the target's. (Optionally maintain a manual "never co-occur" exclusion list for pairs that
   slip through.)
3. **Pool size:** keep enough per category that orthogonal selection always has room — a practical
   floor of **≈ 6+ images per category** (≈ 36+ total) for v1. More is better. `[NEEDS: owner confirms
   pool size / supplies the set]`
4. **Technical specs:** consistent aspect ratio, web-optimized format (e.g. WebP/JPEG), a sensible max
   dimension and file size (suggest long edge ≈ 1600px). `[default-and-flagged — §13]`
5. **Licensing (hard rule, same standard as fonts):** every image must be **legally shippable** —
   public-domain / CC0 / explicitly licensed for this use, with attribution recorded in
   `targets.license`. Do **not** include anything whose license is uncertain. (Public-domain / CC0
   libraries are reasonable candidate sources, but **each image's license must be individually
   verified** — if uncertain about any, exclude it and flag.)

### Seeding (the contract)
Store each image in Supabase Storage and insert a `targets` row. A **Bun seed script** ingests a
**manifest** the owner fills in. Manifest row contract:

```
file | category | attributes(csv) | caption(optional) | license
```

The script uploads each `file` to Storage and inserts the corresponding `targets` row. The actual
images + manifest are owner-supplied: `[NEEDS: curated image set + manifest]`. The implementer builds
the script and the empty manifest template; it must **fail loudly** on a missing/ambiguous license
field rather than inserting an unlicensed image.

---

## 11 · Scope

**In (build this):**
- The full loop, states **1–7** (ready → cool-down → capture → lock → reveal → judge → result).
- **Session history** (frame 08).
- **Stats** (frame 09) with honest sample-size / vs-chance treatment, Wilson interval, p-value, and
  the "i" definitions dialog (§7).
- The **generalizable judging UI** (frame 06; viewer ≠ judger supported in schema + screen).
- The **leaderboard concept**, **stubbed** (see below).
- **Anonymous auth** (Supabase `signInAnonymously()`); RLS keyed on `auth.uid()`.
- Both **light and dark** modes, **defaulting to the device setting**.

**Stubbed in v1 (designed, not live):**
- **Leaderboard.** Surfaced **inside stats** per call **E** (not a top-level tab), gated to
  `n ≥ 20`. The user's own row (`you · n=N · unranked · keep going`) reflects their real `n`; the
  ranked cross-user rows are **stubbed** — a meaningful live ranking needs durable identity and
  sustained-sample logic, which arrive with account upgrade. Build the UI shell; defer live ranking.

**Out of scope (do not build):**
- **ERV / ARV modes** (different methods — later, separate briefs).
- A **full friends/social system** beyond the leaderboard concept + generalizable judging.
- **Account settings, onboarding flows, monetization.**

**`[PLANNED, NOT v1]` — accounted for in schema/architecture, explicitly not built now:**
- **Friend-judging UI** + shareable judge link (schema ready: `judgements.judger_id`).
- **Hand-drawn-note upload** — both (a) **direct UI upload** and (b) a **QR code shown on the site that
  opens a session-scoped upload link** (e.g. a phone scans it to upload a photo of paper notes tied to
  that `session_id`). Reserve `session_attachments`; the future flow uploads **pre-lock only** and the
  attachments become **read-only at lock** like everything else. Do not build it; do not model anything
  that blocks it.
- **Account upgrade** from anonymous to email identity; **live leaderboard** + durable identity.

---

## 12 · Deliverable & acceptance

**Deliverable:** a complete, **runnable Nuxt app** the owner can start and inspect locally
(`bun install && bun run dev`). **The owner deploys** (Netlify, GitHub auto-deploy on `main`).

**Config the owner must provide (do not fabricate):**
`[NEEDS: Supabase project URL + anon key + service-role key]`, `[NEEDS: Netlify site / GitHub repo
link]`, `[NEEDS: curated image set + manifest (§10)]`.

**Acceptance checklist (maps to the non-negotiables):**

- [ ] **Blinding holds** — no target/decoy image path in any pre-lock network response, SSR HTML, or
      hydration payload; signed URLs only post-lock (§4 test).
- [ ] **Lock is irreversible** — the database rejects impression writes once `locked_at` is set, and
      `locked_at` cannot revert; the canvas `locked` state unmounts all edit affordances (§5).
- [ ] **Perceptions vs AOL are separate in *data and UI*** — distinct stores; signal-topped panel vs
      dashed walled-off AOL block (§6, §9).
- [ ] **Scoring is server-side and honest** — hit computed server-side; `n` + 25% baseline always
      shown; Wilson interval + binomial p-value present; p-value set apart; "i" dialog explains all
      stats (§7).
- [ ] **Dark mode defaults to device**; light is a finished equal (§9).
- [ ] **Fonts** are Lato + IBM Plex Mono, bundled and legally shippable (§2).
- [ ] **No React / no ported preview code**; built fresh against NuxtUI (§0, §9).
- [ ] **`sketch_canvas`** supports pointer + touch, two widths, undo/clear, normalized strokes, and the
      empty / drawing / locked states (§8).
- [ ] **Bun only** throughout (§2).

---

## 13 · Open items — consolidated `[NEEDS:]` and default-and-flagged calls

**Owner must supply (blocking for a complete deploy):**
- `[NEEDS: curated target/decoy image set + manifest, with a verified license per image]` (§10).
- `[NEEDS: Supabase project URL + anon key + service-role key]` (§12).
- `[NEEDS: Netlify site / GitHub repo]` (§12).
- `[NEEDS: target pool size confirmation]` (§10 — default floor ≈ 6/category).

**Defaulted, flagged for the owner to confirm or redirect:**
- **Stats display includes *both* the Wilson interval and the binomial p-value.** The owner asked for
  the p-value; the Wilson band is kept as the primary small-*n* honesty cue. *Trim to p-value only if
  preferred.* (§7)
- **Eraser = composite/visual erase, persisted as an `erase`-mode stroke** (not true vector
  subtraction). *Switch if true vector erase is wanted.* (§8)
- **Impressions modeled as separate `session_perceptions` / `session_aol` tables** (signal/noise split
  structural). *Single-table variant acceptable only if the separation is preserved.* (§6)
- **Anonymous-user handle auto-generation scheme** — needs a concrete generator (e.g. readable
  two-token handles). (§6)
- **Image technical specs** (format, max dimension, file size) — sensible defaults proposed. (§10)
- **Watch for a new Nuxt major** and flag before adopting/skipping (project standing rule). (§2)

**Standing guardrails (repeat — apply through planning *and* build):**
- Never fabricate facts, values, or assets; mark unknowns `[NEEDS: …]` and stop on that point.
- **On any uncertainty, ambiguity, or contradiction — ask the owner before proceeding. Do not guess.**
- Bun only. No framework port. Plan first, build second, with owner sign-off before code.
