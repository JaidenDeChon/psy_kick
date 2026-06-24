# psy_kick — design handoff

A practice app for **Controlled Remote Viewing (CRV)**. v1 does one thing: run a single
honest blind session, end to end. This folder is the **design spec** for that build.

> **Thesis.** Rigor is what makes a session meaningful. Blind targets, structured capture,
> and decoy scoring aren't bureaucracy around a mystical experience — they're the only reason
> a real signal can show up. The design makes that discipline feel like **focus, not friction**.

---

## 0 · How to read this handoff (and the one hard rule)

**Build target: Nuxt (latest) · Vue · SSR · NuxtUI · Bun · Netlify.**

🚫 **No-framework-code rule (non-negotiable).** Everything in this folder — the `.dc.html`
previews especially — is **look-and-feel reference ONLY**. It is plain HTML/CSS so it opens in a
browser; it is **not implementation to be translated**. Do **not** port any preview markup into
Vue line-by-line. Build fresh from this spec against NuxtUI primitives. There is **no React here**
and none should be produced.

**Authoritative artifacts, in order:**

| File | What it is |
|---|---|
| `README.md` | This spec — tokens, components, states, motion, copy. The source of truth. |
| `psy_kick_tokens.css` | Every token as CSS custom properties + the NuxtUI `--ui-*` alias layer. Drop into `main.css`. |
| `screens.dc.html` | Visual reference for all 7 loop states + history, stats/leaderboard, judge. Pannable canvas. |
| `drawing_canvas.dc.html` | The one custom component (sketch canvas) + its empty/drawing/locked states, interactive. |

Open the `.dc.html` files in a browser to see the look. Read this doc to build it.

---

## 1 · The session loop (the spine)

Seven states, in order. This sequence **is** the product.

```
1 ready  →  2 cool-down  →  3 capture  →  4 lock  →  5 reveal  →  6 judge  →  7 result
```

1. **ready** — calm entry. Practitioner signals readiness; on begin the *server* mints an opaque
   **target reference number** and seals a target. No image, no category, no clue.
2. **cool-down / tuning-in** — a quiet, low-stimulus moment. Relaxation is part of CRV. One of only
   **two places motion does real work**. Reference number present; nothing competes.
3. **capture** — the working surface, structured as CRV Stages 1–3 + AOL + notes. See §4.
4. **lock** — a deliberate, **irreversible** commit. After this, all work is read-only forever.
   A confirm step is mandatory. Locking triggers reveal.
5. **reveal** — the true target image is uncovered. The emotional peak; the **second** place motion
   earns its keep. The signature moment — spend the design's boldness here.
6. **judge** — target shown with **3 decoys** (4 candidates); rank them. True target at #1 = hit →
   clean **25% chance**. Must generalize to a *different person* judging (viewer ≠ judger).
7. **result** — score, side-by-side (sketch vs image), running stats. Saved to history.

**Supporting surfaces:** session history, stats (hit rate vs the 25% line, sample size prominent),
and a quiet leaderboard.

---

## 2 · Foundations — tokens

All values live in `psy_kick_tokens.css`. Light is `:root`; dark is `.dark` (NuxtUI colorMode
toggles the class). **Dark is the hero register; light is a fully-finished equal.** Default to the
device setting.

### Palette — ink · paper · manila · signal

The hierarchy is the whole discipline. Hold it:

- **signal (blue)** = *"perception breaks through."* Used **only** for live / cool-down / **reveal**.
  Never ambient, never a default button. `#007BFF` (dark) · `#0063DB` deep (AA text on paper).
- **manila / tan** = ambient warmth + everyday accent (buttons, links, structure). This is
  **NuxtUI `--ui-primary`**. `#CDA463` (dark) · `#9A7B3A` (light).
- **black / white** = the worksheet itself (warm-tuned neutrals, not pure gray).

| Semantic | Light | Dark |
|---|---|---|
| `--psy-bg` | `#F6F1E5` paper | `#0E0C0B` void |
| `--psy-bg-base` | `#F1EBDD` | `#131110` |
| `--psy-bg-panel` | `#E7DEC8` | `#1B1815` |
| `--psy-line` | `#D2C7AC` | `#2C2823` |
| `--psy-text` | `#1A1613` ink | `#ECE4D2` bone |
| `--psy-text-muted` | `#5A5142` | `#B8AE99` |
| `--psy-text-faint` | `#8A8068` | `#645C4F` |
| `--psy-tan` (= `--ui-primary`) | `#9A7B3A` | `#CDA463` |
| `--psy-signal` | `#0063DB` | `#007BFF` |
| `--psy-locked` | `#C2503A` | `#C2503A` |
| `--psy-hit` | `#4FA86A` | `#4FA86A` |

Full 50–950 scales for tan, neutral, and signal are in the token file. **Signal is intentionally NOT
in the `--ui-*` layer** — it's a bespoke token so NuxtUI can never spray it onto a default button.

#### How this themes NuxtUI v4 (verified against the attached `.fig`)

The token file was reconciled against this build's actual variable collections (`3 - Tokens`,
`1 - Primary`, `2 - Neutral`, `6 - Radius`). Two things the implementer must know:

1. **You theme the palette scales, not each semantic.** NuxtUI v4 *derives* the semantics from the
   primary + neutral scales. Verbatim from the file's token table (light / dark):

   | derived semantic | light | dark |
   |---|---|---|
   | `--ui-primary` | `primary-500` | `primary-400` |
   | `--ui-text` | `neutral-700` | `neutral-200` |
   | `--ui-text-highlighted` | `neutral-900` | `white` |
   | `--ui-text-toned` | `neutral-600` | `neutral-300` |
   | `--ui-text-muted` | `neutral-500` | `neutral-400` |
   | `--ui-text-dimmed` | `neutral-400` | `neutral-500` |
   | `--ui-bg` | `white` | `neutral-900` |
   | `--ui-bg-elevated` | `neutral-100` | `neutral-800` |
   | `--ui-bg-accented` | `neutral-200` | `neutral-700` |
   | `--ui-border` | `neutral-200` | `neutral-800` |
   | `--ui-border-accented` | `neutral-300` | `neutral-700` |

   So set `--ui-color-primary-*` = the tan scale and `--ui-color-neutral-*` = the warm-gray scale
   (both in the token file) via `@theme` / `app.config.ts`. The file's default primary is Nuxt green
   `#00DC82` — the tan override drops straight into that slot.

2. **The manila warmth needs a few explicit semantic overrides.** Stock NuxtUI uses one symmetric
   gray ramp where light-surfaces and dark-text share indices; the archival look isn't symmetric, so
   the token file also pins `--ui-bg` (= paper / void), `--ui-bg-accented`, the borders, and the bone
   body text directly. These win regardless of ramp drift, guaranteeing the look. Use the **v4 names
   verbatim** — note `--ui-bg-elevated` / `--ui-bg-accented` (there is no `--ui-bg-muted`), plus
   `--ui-text-toned` / `--ui-text-highlighted` / `--ui-*-inverted`.

### Type — Lato (voice) + IBM Plex Mono (data)

> **Designer's call, flagged.** The brief pinned mono-led; you chose Lato. I'm pairing rather than
> replacing, to keep the declassified-worksheet identity §6 pins. **Lato carries all human reading**
> (display, body, UI, buttons). **IBM Plex Mono is reserved for *data*** — the reference token,
> snake_case system labels, stage indicators, scores, timestamps. Both are Google Fonts / OFL,
> legally shippable. If you'd rather Lato carry data too, drop the mono — but you lose the
> coordinate/terminal read.

- `--psy-font-sans: "Lato"` — weights 300 / 400 / 700 / 900.
- `--psy-font-mono: "IBM Plex Mono"` — weights 400 / 500 / 600.

| Role | Family | Size / weight |
|---|---|---|
| display (ready, reveal headline) | Lato | 54–88px / 900, tracking −0.02em |
| section heading | Lato | 22–26px / 900 |
| body / instruction | Lato | 15–16px / 400, line-height 1.7 |
| button | Lato | 14–15px / 700 |
| reference token | IBM Plex Mono | 18–34px / 600, tracking 0.14em |
| snake_case label | IBM Plex Mono | 10–11px / 500, tracking 0.18em, uppercase |
| data / score / meta | IBM Plex Mono | 11–13px / 400–600 |

### Radius, spacing, elevation

- **`--ui-radius: 2px`** — `--ui-radius` is a **base float** (the file's default is 4px); components
  compute their corners as `calc(var(--ui-radius) * 1.5 / 2 / 2.5 / 3)`, so setting it to 2px halves
  every corner globally. Verified against the `6 - Radius` collection.
- Spacing follows NuxtUI's 4px scale (unchanged); type ramp uses Tailwind's named sizes
  (`text-xs`…`text-7xl`), matching the file's `4 - Font` collection.
- This build's default fonts are **DM Sans / Public Sans** — Lato + IBM Plex Mono override them via
  `--ui-font-sans` / `--ui-font-mono`.
- **Elevation is mostly structural lines, not shadow.** On paper, near-zero shadow. In dark, panels
  separate by `--psy-bg-panel` + 1px `--psy-line`. Modals get `--psy-shadow-md`.

### The signal glow (the one effect)

`box-shadow: 0 0 22px var(--psy-signal-glow)` / text-shadow variant. Use it on: the live recording
dot, the cool-down orb, the active stage marker, and the reveal burst. **Nowhere else.** Scarcity is
what keeps the look from collapsing into hacker-terminal / crypto-dashboard. The other guard is the
manila warmth softening every surface — keep both and the look is unmistakably psy_kick.

---

## 3 · Brand motif — the underscore

`psy_kick` is lowercase with an underscore; let it carry through the UI.

- **snake_case labels** everywhere structural: `target_reference`, `gestalt_tag`, `aol_log`,
  `lock_session`, `begin_session`.
- A **blinking cursor mark** (`_`, signal-colored, `psy-blink` keyframe) on the wordmark and on
  waiting/standby states.
- The reference number styled as a **terminal/coordinate token**: `8302—517`, mono, wide tracking,
  the em-dash in tan.

---

## 4 · Capture screen — the hard one

Holds freeform drawing **and** structured data **and** the AOL separation, without reading as a form.
See `screens.dc.html` frame 03. Composition top→bottom:

1. **Header** — the `target_reference` token (left) + **stage stepper** ●●○ (right). The stepper is
   meaningful, not decorative: CRV stages are a true ordered sequence. Active stage = signal dot + glow.
2. **PERCEPTIONS panel (the signal)** — bordered, **topped with a 2px signal line**, label in signal.
   Contains:
   - *Stage 1* — ideogram field (small fast drawing) + gestalt chips (land / water / structure /
     motion / life / energy; selected = tan).
   - *Stage 2* — sensory fields as a **separated grid** (color, texture, temp, sound, smell, taste).
     The separation **is the point** — never one freeform blob.
   - *Stage 3* — dimensional chips (tall / wide / open / enclosed…) + the main **sketch canvas** (§6).
3. **AOL zone (the noise) — categorically different.** A **dashed**, muted, walled-off block, label
   `aol_log · set_aside`, italic muted text. It must never read like the perception fields. This
   teaches the core pedagogy: raw perception is signal; analytic guesses are noise to dump and ignore.
4. **Freeform notes** — a catch-all line.
5. **`lock_session`** — tan commit button, bottom-right, weighty.

**Integrity rules baked into the design (all four are non-negotiable):**

- **Blinding is absolute.** Capture + cool-down show the reference number and **nothing
  image-derived**. Design as if the image isn't on the page — because the server guarantees it isn't.
- **Lock is irreversible and looks it** — distinct sealed state, no edit affordances survive.
- **Perceptions vs AOL are visually separate** — signal-topped panel vs dashed walled-off block.
- **Scoring is decoy-based and honest** — always shown with sample size + the 25% baseline.

---

## 5 · Component inventory → NuxtUI

Map to primitives; theme via tokens + `app.config.ts`. Custom only where noted.

| Need | NuxtUI | psy_kick notes |
|---|---|---|
| begin / lock / judge / save | `UButton` | primary = tan. Lock confirm button uses `--psy-locked` red. |
| session entry, stat card, leaderboard row | `UCard` | 1px line, 2px radius, panel bg. |
| lock confirm / reveal / judging | `UModal` / `USlideover` | lock modal = weighty, two buttons (cancel / lock & reveal). |
| CRV stage progression | `UStepper` (or tabs) | 3 stages; active = signal dot + glow. Encodes real method order. |
| sensory fields, notes | `UInput` / `UTextarea` / `UFormField` / `UForm` | inset bg, mono micro-labels. |
| gestalt / dimensional tags | `UBadge` / `UChip` | selected = tan border+text; idle = line border, muted. |
| reference number, Locked state | `UBadge` / `UChip` | mono coordinate token; Locked = red sealed chip. |
| cool-down + stage progress | `UProgress` | cool-down pairs with the breathing orb (custom motion, §7). |
| history / leaderboard | `UTable` or card list | `UAvatar` for friends later. |
| blinding / AOL explainers | `UAlert` / `UTooltip` | teach, don't nag. |
| **sketch + ideogram canvas** | **custom** | the only non-primitive. See §6 + `drawing_canvas.dc.html`. |

---

## 6 · The custom component — `sketch_canvas`

Live reference + state spec: `drawing_canvas.dc.html`. Keep it deliberate — it serves the protocol,
not a full illustration app.

- **Tools:** pen, eraser, undo, clear, **two stroke widths** (thin ≈ 2.5 / thick ≈ 6). Active tool =
  signal outline.
- **Input:** unified **pointer events** (mouse + touch + pen). People will draw on phones —
  `touch-action: none` on the canvas; use `getCoalescedEvents()` for smooth strokes.
- **Model (persistable):** `stroke = { mode:'pen'|'erase', width:number, points:[x,y][] }`; the whole
  sketch is `stroke[]`. Serialise it to the session record; re-render on load. This same array feeds
  the **judge** and **result** thumbnails.
- **States:**
  - `empty` — placeholder hint, tools enabled.
  - `drawing` — strokes render live.
  - `locked` — render `stroke[]` to a flat read-only layer and **unmount the toolbar entirely**.
    No edit affordance survives the lock.

There are two canvases on capture (small **ideogram** + main **sketch**); same component, different size.

---

## 7 · Motion — exactly two moments

Motion is **scarce everywhere else** (scattered animation reads as machine-made). It does real work in
two places, and both honor `prefers-reduced-motion`.

- **cool-down (calm).** A slow **breathing orb** — signal radial, `psy-breath` ~4.6s ease-in-out
  (scale .72↔1, opacity .45↔1) with expanding `psy-ring` halos. Reads as a held breath, **not** a
  loading spinner. Reduced-motion: a static glowing orb, no pulse.
- **reveal (the payoff).** The blind mono reference number **flares**, then the target image settles
  in (mono pointer → image crossfade, brief inner signal glow). This is the signature moment — the
  thing the app is remembered by. Reduced-motion fallback: a **clean crossfade, no flash**, that still
  lands.

Keyframes (`psy-blink`, `psy-breath`, `psy-ring`) are in the token file, gated behind the
reduced-motion media query.

---

## 8 · Honest scoring & the quiet leaderboard

- **Score = rank-order vs decoys**, never a vibe check. True target at #1 of 4 = hit. Chance = 25%.
- **Always show sample size + the 25% baseline.** Someone hitting 5/5 by luck must see "5 sessions"
  loudly enough not to mistake noise for a gift. Stats screen pins `n =` next to every rate, draws the
  25% line on the chart, and states the confidence cue ("a confident signal needs ~30+ sessions").
- **Leaderboard is quiet** (designer's call E): surfaced **inside stats**, not a top-level tab, and
  **gated to sustained samples** (`n ≥ 20`) so lucky streaks don't rank. "You" appears as unranked
  with an encouraging keep-going until you qualify.
- **Judge generalizes to viewer ≠ judger** (frame 06): the judger sees only the recorded
  notes + sketch + four images, then ranks. Nothing about the screen assumes they're the original
  viewer — this is what lets a friend judge.

---

## 9 · Scope

**In:** the full loop (states 1–7), session history, stats (honest sample-size / vs-chance),
leaderboard concept, generalizable judging UI.

**Out (don't build yet):** ERV / ARV modes, full social system beyond leaderboard + judging, account
settings, onboarding, monetization.

---

## 10 · Designer's calls (signed off)

| # | Call | Status |
|---|---|---|
| A | signal = jaiden.dev blue `#007BFF` / `#0063DB`, glow kept | ✅ |
| B | Lato (voice) + IBM Plex Mono (data) pairing — flagged in §2 | ✅ |
| C | signal ≠ `--ui-primary`; tan drives everyday UI | ✅ |
| D | `--ui-radius: 2px` (sharp instrument edges) | ✅ |
| E | leaderboard quiet — inside stats, `n ≥ 20` gate | ✅ |
