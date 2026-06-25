#!/usr/bin/env bun
/**
 * upload-seed.ts — push the built seed images into the PRIVATE Supabase
 * 'targets' bucket and insert the matching rows into the `targets` table.
 * ----------------------------------------------------------------------------
 * This is the companion to seed-targets.ts (which fetches + builds seed/). It
 * reads seed/targets.csv and, for each row:
 *   1) uploads seed/<file> to the 'targets' bucket at key <file> (e.g.
 *      images/land_001.jpg) — these are remote-viewing TARGETS and must never
 *      be publicly fetchable; the bucket is private and served only via the
 *      post-lock signed URLs minted in server/.
 *   2) inserts a targets row with storage_path = <file>, so getSignedImageUrl()
 *      (server/utils/images.ts) resolves it 1:1.
 *
 * IDEMPOTENT: storage uploads use upsert; DB rows are inserted only when no row
 * with that storage_path already exists — safe to re-run after adding images.
 *
 * REQUIRES env (auto-loaded from .env.local by Bun):
 *   NUXT_PUBLIC_SUPABASE_URL, NUXT_SUPABASE_SERVICE_KEY
 * RUN:  bun run scripts/upload-seed.ts        (or: bun run seed:upload)
 * ----------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

const URL = Bun.env.NUXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = Bun.env.NUXT_SUPABASE_SERVICE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing NUXT_PUBLIC_SUPABASE_URL or NUXT_SUPABASE_SERVICE_KEY (set them in .env.local).");
  process.exit(1);
}

const SEED_DIR = "seed";
const CSV_PATH = join(SEED_DIR, "targets.csv");
const BUCKET = "targets";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif",
};

// Minimal RFC-4180 CSV parser — targets.csv has quoted captions with commas.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped ""
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

const csv = await Bun.file(CSV_PATH).text();
const rows = parseCsv(csv).filter((r) => r.length > 1 && r[0]);
const header = rows.shift();
if (!header || header[0] !== "file") {
  console.error(`Unexpected header in ${CSV_PATH}: ${header?.join(",")}`);
  process.exit(1);
}

// Which storage_paths already exist — keeps re-runs from duplicating rows.
const { data: existing, error: exErr } = await db.from("targets").select("storage_path");
if (exErr) { console.error(`Could not read targets table: ${exErr.message}`); process.exit(1); }
const have = new Set((existing ?? []).map((r) => r.storage_path));

let uploaded = 0, skipped = 0;
const toInsert: Record<string, unknown>[] = [];

for (const [file, category, attributes, caption, license] of rows) {
  const localPath = join(SEED_DIR, file);
  const f = Bun.file(localPath);
  if (!(await f.exists())) { console.warn(`  ! missing ${localPath} — skipping`); continue; }

  const ext = (file.match(/\.[a-z0-9]+$/i)?.[0] ?? ".jpg").toLowerCase();
  const bytes = new Uint8Array(await f.arrayBuffer());

  const { error: upErr } = await db.storage.from(BUCKET).upload(file, bytes, {
    contentType: MIME[ext] ?? "image/jpeg",
    upsert: true,
  });
  if (upErr) { console.warn(`  ! upload ${file} failed: ${upErr.message}`); continue; }
  uploaded++;

  if (have.has(file)) { skipped++; continue; }
  toInsert.push({
    storage_path: file,
    category,
    attributes: attributes ? attributes.split(";").map((s) => s.trim()).filter(Boolean) : [],
    caption: caption || null,
    license,
    active: true,
  });
}

if (toInsert.length) {
  const { error: insErr } = await db.from("targets").insert(toInsert);
  if (insErr) { console.error(`Insert failed: ${insErr.message}`); process.exit(1); }
}

console.log(`\nDone. Uploaded ${uploaded} file(s) to private bucket '${BUCKET}'.`);
console.log(`  Inserted ${toInsert.length} new target row(s); ${skipped} already present.`);
