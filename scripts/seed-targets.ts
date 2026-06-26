#!/usr/bin/env bun
/**
 * seed-targets.ts — psy_kick target/decoy image seeding from Pixabay
 * ----------------------------------------------------------------------------
 * The per-category cull is now AUTOMATED. Flow:
 *
 *   1) bun run seed fetch
 *        - queries Pixabay per category (categories ARE the queries — no classifier)
 *        - filters by size, dedupes by id + byte-hash + perceptual hash
 *        - downloads a candidate POOL per category to seed/candidates/<category>/
 *        - AUTO-SELECTS the most visually-distinct `targetPerCategory` from that
 *          pool (structure + colour fingerprint, farthest-first) — distinct
 *          WITHIN and ACROSS categories. No manual eyeballing required.
 *        - writes manifest.json + review.html (now an OPTIONAL sanity sheet)
 *
 *   2) (optional) glance at review.html; set "keep": false on any dud, or skip.
 *
 *   3) bun run seed build
 *        - copies the kept originals to seed/images/<category>_NNN.<ext>
 *        - writes targets.csv (your schema) + provenance.csv (audit/attribution)
 *        - records built Pixabay ids in seed/seeded-ids.json so the NEXT run adds
 *          new photos instead of re-adding ones you already have.
 *
 *   4) bun run seed:upload   (upload-seed.ts → private bucket + targets rows)
 *
 * PRECAUTIONS BAKED IN
 *   - LICENSE: current Pixabay uploads are the *Pixabay Content License*, NOT
 *     CC0 / public domain. Labelled accurately. For genuine CC0/PD, source from
 *     Wikimedia Commons / Openverse and change LICENSE per source.
 *   - ATTRIBUTION (required): provenance.csv carries contributor + source page.
 *   - COMPLIANCE: 24h API cache, throttled calls, 429 handling, courtesy delays.
 *     Scope is a curated few-hundred, not a scraper.
 *   - NO CONVERSION: originals stored as-is; @nuxt/image handles serve-time formats.
 *
 *   ⚠ BLINDING: outputs land in seed/, NOT public/. These are remote-viewing
 *     TARGETS — never publicly fetchable. Upload to a PRIVATE Supabase bucket and
 *     serve only via post-lock signed URLs.
 *
 * REQUIRES: Bun >= 1.3.14 (for Bun.Image) · env PIXABAY_API_KEY
 * INSTALL:  bun add jpeg-js
 * ----------------------------------------------------------------------------
 */

import { join, extname } from "node:path";
import jpeg from "jpeg-js";

const KEY = Bun.env.PIXABAY_API_KEY;
if (!KEY) {
  console.error("Missing PIXABAY_API_KEY. Get one at https://pixabay.com/api/docs/ and export it.");
  process.exit(1);
}

// Pixabay images are NOT CC0. This is the accurate label for Pixabay-sourced rows.
const LICENSE = "Pixabay Content License";

const CONFIG = {
  imagesSubdir: "images",           // CSV `file` prefix; matches your schema
  outDir: "seed",                   // final CSV + images — keep OUT of public/
  candidatesDir: "seed/candidates",
  cacheDir: "seed/.cache",
  csvPath: "seed/targets.csv",
  provenancePath: "seed/provenance.csv",
  manifestPath: "seed/candidates/manifest.json",
  reviewPath: "seed/candidates/review.html",
  ledgerPath: "seed/seeded-ids.json", // Pixabay ids already committed → skipped on re-run

  minWidth: 1280,
  minHeight: 720,
  orientation: "all",               // "all" | "horizontal" | "vertical"
  perTerm: 25,                      // results requested per query term (API allows 3–200)
  candidatesPerCategory: 40,        // size of the deduped POOL we auto-select FROM
  targetPerCategory: 16,            // how many DISTINCT images to keep per category
  hammingThreshold: 10,             // <= this between dHashes => near-duplicate (dropped pre-select)
  structureWeight: 0.55,            // distinctness = 0.55*structure + 0.45*colour
  editorsChoice: false,             // true = higher quality but far fewer hits
  requestDelayMs: 1200,             // politeness between live API calls
  downloadDelayMs: 250,             // courtesy delay between image downloads
  maxRetries: 1,                    // retries on HTTP 429 (rate limit)
  cacheTtlMs: 24 * 60 * 60 * 1000,  // Pixabay's required 24h cache
  maxPixels: 6000 * 6000,           // Bun.Image decompression-bomb guard
};

// Categories ARE the queries. Expand these lists per category to grow the pool —
// the auto-selector then keeps only the most distinct from whatever you fetch.
// motion and energy run WITHOUT a pixabayCategory filter (the `category` param is
// a strict AND-filter and would starve them).
type CategorySpec = { queries: string[]; pixabayCategory?: string; base: string[] };
const CATEGORIES: Record<string, CategorySpec> = {
  land: {
    base: ["outdoor", "natural"], pixabayCategory: "nature",
    queries: ["rolling hills", "desert dunes", "canyon landscape", "mountain valley", "rocky coastline cliff", "open plateau"],
  },
  water: {
    base: ["outdoor"], pixabayCategory: "nature",
    queries: ["calm lake", "ocean waves", "river rapids", "frozen lake", "misty fjord", "tropical lagoon"],
  },
  structure: {
    base: ["outdoor", "geometric"], pixabayCategory: "buildings",
    queries: ["steel bridge", "skyscraper exterior", "lighthouse", "hydroelectric dam", "radio tower", "stone archway"],
  },
  motion: {
    base: ["outdoor", "dynamic"], // no category filter (diverse subjects)
    queries: ["waterfall long exposure", "crashing ocean wave", "flock of birds flying", "blowing sand storm", "spinning windmill", "fast flowing stream"],
  },
  life: {
    base: ["outdoor", "organic"], pixabayCategory: "nature",
    queries: ["forest canopy", "coral reef fish", "wildflower meadow", "herd of elephants", "dense jungle", "lone oak tree"],
  },
  energy: {
    base: ["luminous"], // no category filter (lightning/lava/neon don't share one)
    queries: ["lightning storm", "lava flow volcano", "wildfire flames", "geyser eruption", "city neon lights night", "solar flare sun"],
  },
};

// --- Pixabay hit shape (subset we use) --------------------------------------
type Hit = {
  id: number; pageURL: string; tags: string; type: string;
  imageWidth: number; imageHeight: number;
  largeImageURL: string; user: string; user_id: number;
};

// --- helpers ----------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchPixabay(query: string, pixabayCategory?: string, attempt = 0): Promise<Hit[]> {
  const params = new URLSearchParams({
    q: query,
    image_type: "photo",
    safesearch: "true",
    order: "popular",
    min_width: String(CONFIG.minWidth),
    min_height: String(CONFIG.minHeight),
    per_page: String(CONFIG.perTerm),
  });
  if (pixabayCategory) params.set("category", pixabayCategory);
  if (CONFIG.orientation !== "all") params.set("orientation", CONFIG.orientation);
  if (CONFIG.editorsChoice) params.set("editors_choice", "true");

  // Cache key is derived from the query only — the API key never touches disk.
  const cacheId = `${pixabayCategory ?? "any"}__${query}__w${CONFIG.minWidth}__n${CONFIG.perTerm}__${CONFIG.orientation}`
    .replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const cacheFile = join(CONFIG.cacheDir, `${cacheId}.json`);

  if (await Bun.file(cacheFile).exists()) {
    const cached = await Bun.file(cacheFile).json();
    if (Date.now() - cached.fetchedAt < CONFIG.cacheTtlMs) return cached.hits as Hit[];
  }

  // Live request — key is added only here, and we never log the full URL.
  const res = await fetch(`https://pixabay.com/api/?key=${KEY}&${params.toString()}`);

  // Pixabay returns 429 with an X-RateLimit-Reset (seconds until the window resets).
  if (res.status === 429 && attempt < CONFIG.maxRetries) {
    const reset = Number(res.headers.get("X-RateLimit-Reset")) || 30;
    console.warn(`  · rate limited; waiting ${reset + 1}s before retry…`);
    await sleep((reset + 1) * 1000);
    return searchPixabay(query, pixabayCategory, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pixabay ${res.status} for "${query}": ${body.slice(0, 160)}`);
  }

  const json = (await res.json()) as { hits: Hit[] };
  await Bun.write(cacheFile, JSON.stringify({ fetchedAt: Date.now(), hits: json.hits }));
  await sleep(CONFIG.requestDelayMs);
  return json.hits;
}

// Perceptual dHash. Bun.Image does the fast native resize; jpeg-js reads the
// 9x8 pixels because Bun.Image has no raw-pixel output yet. Returns null on any
// decode failure (we then fall back to exact-dedup only for that image).
async function dHash(bytes: Uint8Array): Promise<bigint | null> {
  try {
    const small = await new Bun.Image(bytes, { maxPixels: CONFIG.maxPixels })
      .resize(9, 8, { fit: "fill" })
      .jpeg()
      .bytes();
    const { width, height, data } = jpeg.decode(small, { useTArray: true });
    if (width !== 9 || height !== 8) return null;
    const luma = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let hash = 0n, bit = 0n;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = (y * 9 + x) * 4;
        const j = (y * 9 + x + 1) * 4;
        if (luma(i) > luma(j)) hash |= 1n << bit;
        bit++;
      }
    }
    return hash;
  } catch {
    return null;
  }
}

function hamming(a: bigint, b: bigint): number {
  let x = a ^ b, n = 0;
  while (x > 0n) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

// ─── perceptual signature: structure (dHash) + coarse colour ────────────────
// dHash captures gradient/structure but is colour-blind; a 4x4 average-colour
// grid fills that gap. Together they're a usable proxy for "visually distinct".
type Sig = { dhash: bigint | null; color: number[] | null };

async function colorSig(bytes: Uint8Array): Promise<number[] | null> {
  try {
    const small = await new Bun.Image(bytes, { maxPixels: CONFIG.maxPixels })
      .resize(4, 4, { fit: "fill" })
      .jpeg()
      .bytes();
    const { width, height, data } = jpeg.decode(small, { useTArray: true });
    if (width !== 4 || height !== 4) return null;
    const sig: number[] = [];
    for (let p = 0; p < 16; p++) {
      const i = p * 4; // RGBA
      sig.push(data[i], data[i + 1], data[i + 2]);
    }
    return sig; // 48 dims, 0..255
  } catch {
    return null;
  }
}

// Combined perceptual distance in [0,1]. A missing component contributes 0.5.
function perceptualDist(a: Sig, b: Sig): number {
  let s = 0.5;
  if (a.dhash !== null && b.dhash !== null) s = hamming(a.dhash, b.dhash) / 64;
  let c = 0.5;
  if (a.color && b.color) {
    let sum = 0;
    for (let i = 0; i < a.color.length; i++) { const d = a.color[i] - b.color[i]; sum += d * d; }
    c = Math.sqrt(sum) / (Math.sqrt(a.color.length) * 255);
  }
  return CONFIG.structureWeight * s + (1 - CONFIG.structureWeight) * c;
}

// Farthest-first selection: greedily pick the k items most spread apart, also
// staying far from `ref` (images already chosen in earlier categories). This is
// the automated stand-in for the manual "keep the visually-distinct ones" cull.
function selectDiverse<T extends { sig: Sig }>(items: T[], k: number, ref: Sig[]): T[] {
  if (items.length <= k) return [...items];
  const taken = new Array(items.length).fill(false);
  const minDist = items.map((it) =>
    ref.length ? Math.min(...ref.map((r) => perceptualDist(it.sig, r))) : Number.POSITIVE_INFINITY
  );
  const chosen: T[] = [];
  for (let step = 0; step < k; step++) {
    let bi = -1, best = -1;
    for (let i = 0; i < items.length; i++) {
      if (!taken[i] && minDist[i] > best) { best = minDist[i]; bi = i; }
    }
    if (bi < 0) break;
    taken[bi] = true;
    chosen.push(items[bi]);
    for (let i = 0; i < items.length; i++) {
      if (taken[i]) continue;
      const d = perceptualDist(items[bi].sig, items[i].sig);
      if (d < minDist[i]) minDist[i] = d;
    }
  }
  return chosen;
}

// ─── seeded-id ledger: photos already committed; skipped on future runs ──────
async function loadLedger(): Promise<Set<number>> {
  const f = Bun.file(CONFIG.ledgerPath);
  if (!(await f.exists())) return new Set();
  try {
    const ids = (await f.json()) as number[];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

async function saveLedger(ids: Set<number>): Promise<void> {
  await Bun.write(CONFIG.ledgerPath, JSON.stringify([...ids].sort((a, b) => a - b)));
}

function extFromUrl(url: string): string {
  const e = extname(new URL(url).pathname).toLowerCase();
  return e && e.length <= 5 ? e : ".jpg";
}

const STOP = new Set(["the", "a", "of", "and", "with", "in", "on", "at", "to", "for"]);
const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

function suggestCaption(tags: string): string {
  const parts = tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3);
  return titleCase(parts.join(" "));
}

function suggestAttributes(tags: string, base: string[]): string {
  const fromTags = tags.split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && t.length <= 14 && !STOP.has(t) && !t.includes(" "))
    .map((t) => t.replace(/[^a-z0-9]+/g, "_"));
  const merged: string[] = [];
  for (const a of [...base, ...fromTags]) if (!merged.includes(a)) merged.push(a);
  return merged.slice(0, 4).join(";");
}

const csvField = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csvRow = (fields: string[]) => fields.map(csvField).join(",");
const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// --- manifest type ----------------------------------------------------------
type Candidate = {
  keep: boolean;            // set false in review to drop (optional now)
  category: string;
  file: string;             // candidate path (relative to project root)
  id: number;               // Pixabay id (also feeds the seeded-id ledger)
  pageURL: string;
  user: string;
  userId: number;
  tags: string;
  sourceQuery: string;
  width: number;
  height: number;
  phash: string | null;
  caption: string;          // suggested — edit in review if you like
  attributes: string;       // suggested — edit in review if you like
  license: string;
};

// --- fetch command ----------------------------------------------------------
async function runFetch() {
  const manifest: Candidate[] = [];
  const seededIds = await loadLedger();        // skip photos already committed
  const globalRef: Sig[] = [];                 // chosen sigs so far → cross-category distinctness

  for (const [category, spec] of Object.entries(CATEGORIES)) {
    console.log(`\n[${category}] querying ${spec.queries.length} terms…`);
    const byId = new Map<number, Hit & { sourceQuery: string }>();

    for (const q of spec.queries) {
      let hits: Hit[] = [];
      try {
        hits = await searchPixabay(q, spec.pixabayCategory);
      } catch (e) {
        console.warn(`  ! "${q}" failed: ${(e as Error).message}`);
        continue;
      }
      if (hits.length === 0) console.log(`  · "${q}" returned 0 hits — consider a different term`);
      for (const h of hits) {
        if (h.type !== "photo") continue;
        if (h.imageWidth < CONFIG.minWidth || h.imageHeight < CONFIG.minHeight) continue;
        if (seededIds.has(h.id)) continue;     // already in the pool from a previous run
        if (!byId.has(h.id)) byId.set(h.id, { ...h, sourceQuery: q });
      }
    }

    // Build a deduped candidate POOL (near-dups removed), then auto-select from it.
    const pool: { cand: Candidate; sig: Sig }[] = [];
    const keptHashes: bigint[] = [];
    const seenContent = new Set<string>();

    for (const h of byId.values()) {
      if (pool.length >= CONFIG.candidatesPerCategory) break;

      let bytes: Uint8Array<ArrayBuffer>;
      try {
        const res = await fetch(h.largeImageURL);
        if (!res.ok) { console.warn(`  ! download ${h.id} -> ${res.status}`); continue; }
        bytes = new Uint8Array(await res.arrayBuffer());
        await sleep(CONFIG.downloadDelayMs); // courtesy throttle
      } catch {
        console.warn(`  ! download ${h.id} failed`);
        continue;
      }

      const content = await sha256(bytes);
      if (seenContent.has(content)) continue;                      // byte-identical

      const ph = await dHash(bytes);
      if (ph !== null && keptHashes.some((k) => hamming(k, ph) <= CONFIG.hammingThreshold)) {
        continue;                                                   // near-duplicate
      }
      const color = await colorSig(bytes);

      const ext = extFromUrl(h.largeImageURL);
      const file = join(CONFIG.candidatesDir, category, `${h.id}${ext}`);
      await Bun.write(file, bytes);                                 // Bun.write makes dirs

      seenContent.add(content);
      if (ph !== null) keptHashes.push(ph);
      pool.push({
        cand: {
          keep: true, category, file, id: h.id, pageURL: h.pageURL, user: h.user, userId: h.user_id,
          tags: h.tags, sourceQuery: h.sourceQuery, width: h.imageWidth, height: h.imageHeight,
          phash: ph === null ? null : ph.toString(16),
          caption: suggestCaption(h.tags),
          attributes: suggestAttributes(h.tags, spec.base),
          license: LICENSE,
        },
        sig: { dhash: ph, color },
      });
    }

    // Auto-select the most visually-distinct set — distinct within this category
    // AND pushed away from everything already chosen in other categories.
    const chosen = selectDiverse(pool, CONFIG.targetPerCategory, globalRef);
    for (const x of chosen) globalRef.push(x.sig);

    if (chosen.length < CONFIG.targetPerCategory) {
      console.warn(`  ⚠ only ${chosen.length} distinct of ${pool.length} (< ${CONFIG.targetPerCategory}); add query terms for "${category}".`);
    } else {
      console.log(`  auto-selected ${chosen.length} of ${pool.length} (max-distinct).`);
    }
    manifest.push(...chosen.map((x) => x.cand));
  }

  await Bun.write(CONFIG.manifestPath, JSON.stringify(manifest, null, 2));
  await Bun.write(CONFIG.reviewPath, renderReview(manifest));

  console.log(`\nWrote ${manifest.length} auto-selected candidates across ${Object.keys(CATEGORIES).length} categories.`);
  console.log(`  Review (optional):  open ${CONFIG.reviewPath}`);
  console.log(`  Then:               bun run seed build`);
}

function renderReview(manifest: Candidate[]): string {
  const byCat = new Map<string, Candidate[]>();
  for (const c of manifest) {
    const arr = byCat.get(c.category);
    if (arr) arr.push(c);
    else byCat.set(c.category, [c]);
  }

  const sections = [...byCat.entries()].map(([cat, items]) => {
    const cards = items.map((c) => {
      const rel = c.file.replace(`${CONFIG.candidatesDir}/`, ""); // review.html sits in candidatesDir
      return `<figure>
  <img src="${rel}" loading="lazy" alt="#${c.id}">
  <figcaption>
    <b>#${c.id}</b> · ${c.width}×${c.height}<br>
    <span class="cap">${escapeHtml(c.caption)}</span><br>
    <span class="attr">${escapeHtml(c.attributes)}</span><br>
    <a href="${c.pageURL}" target="_blank" rel="noopener">source · ${escapeHtml(c.user)}</a>
  </figcaption>
</figure>`;
    }).join("\n");
    return `<h2>${cat} <small>(${items.length})</small></h2>\n<div class="grid">${cards}</div>`;
  }).join("\n");

  return `<!doctype html><meta charset="utf-8"><title>psy_kick · candidate review</title>
<style>
  body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:2rem;background:#f4efe6;color:#1a1a1a}
  h1{font-weight:700;letter-spacing:-.02em} h2{margin-top:2.4rem;text-transform:uppercase;letter-spacing:.06em}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
  figure{margin:0;background:#fff;border:1px solid #d8cdbb;border-radius:6px;overflow:hidden}
  img{width:100%;height:160px;object-fit:cover;display:block;background:#e8e0d2}
  figcaption{padding:.5rem .6rem;font-size:.78rem;line-height:1.45}
  .cap{font-weight:600} .attr{color:#6b6256} a{color:#7a6a52}
  p.note{max-width:62ch;color:#444;line-height:1.55}
  code{background:#e8e0d2;padding:.05rem .3rem;border-radius:3px}
</style>
<h1>psy_kick · candidate review</h1>
<p class="note">These were <b>auto-selected</b> for maximum visual distinctness (structure + colour),
within and across categories. This sheet is an <em>optional</em> sanity check — set
<code>"keep": false</code> on any dud in <code>manifest.json</code>, or just run <code>bun run seed build</code>.</p>
${sections}`;
}

// --- build command ----------------------------------------------------------
async function runBuild() {
  if (!(await Bun.file(CONFIG.manifestPath).exists())) {
    console.error(`No manifest at ${CONFIG.manifestPath}. Run "fetch" first.`);
    process.exit(1);
  }
  const manifest = (await Bun.file(CONFIG.manifestPath).json()) as Candidate[];
  const keepers = manifest.filter((c) => c.keep);

  const csvRows = [csvRow(["file", "category", "attributes", "caption", "license"])];
  const provRows = [csvRow(["file", "id", "pageURL", "user", "user_id", "tags", "sourceQuery", "phash"])];
  const counters = new Map<string, number>();

  for (const c of keepers) {
    const n = (counters.get(c.category) ?? 0) + 1;
    counters.set(c.category, n);
    const seq = String(n).padStart(3, "0");
    const ext = extname(c.file) || ".jpg";
    const rel = `${CONFIG.imagesSubdir}/${c.category}_${seq}${ext}`;

    await Bun.write(join(CONFIG.outDir, rel), Bun.file(c.file)); // copy original, no conversion
    csvRows.push(csvRow([rel, c.category, c.attributes, c.caption, c.license]));
    provRows.push(csvRow([rel, String(c.id), c.pageURL, c.user, String(c.userId), c.tags, c.sourceQuery, c.phash ?? ""]));
  }

  await Bun.write(CONFIG.csvPath, csvRows.join("\n") + "\n");
  await Bun.write(CONFIG.provenancePath, provRows.join("\n") + "\n");

  // Remember these photos so the next fetch adds NEW ones, not repeats.
  const ledger = await loadLedger();
  for (const c of keepers) ledger.add(c.id);
  await saveLedger(ledger);

  const summary = [...counters.entries()].map(([c, n]) => `${c}:${n}`).join("  ") || "(none kept)";
  console.log(`Built ${keepers.length} targets`);
  console.log(`  ${summary}`);
  console.log(`  CSV:        ${CONFIG.csvPath}`);
  console.log(`  Provenance: ${CONFIG.provenancePath}`);
  console.log(`  Ledger:     ${CONFIG.ledgerPath}  (${ledger.size} ids total)`);
  console.log(`  Images:     ${join(CONFIG.outDir, CONFIG.imagesSubdir)}/  ← upload to a PRIVATE Supabase bucket, never public/`);
}

// --- dispatch ---------------------------------------------------------------
const cmd = process.argv[2];
if (cmd === "fetch") await runFetch();
else if (cmd === "build") await runBuild();
else {
  console.log(`psy_kick target seeder

Usage:
  bun run seed fetch     # query Pixabay, dedupe, AUTO-SELECT the most distinct per category
  bun run seed build     # emit targets.csv + copy chosen images + update the seeded-id ledger
  bun run seed:upload    # push images to the PRIVATE Supabase bucket + insert rows

Requires Bun >= 1.3.14 and env PIXABAY_API_KEY.   Install dep:  bun add jpeg-js`);
}
