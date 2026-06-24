#!/usr/bin/env bun
/**
 * psy_kick seed script — ingests target images from a manifest CSV.
 *
 * Usage:
 *   bun run scripts/seed-targets.ts
 *
 * Prerequisites:
 *   1. Set env vars (NUXT_PUBLIC_SUPABASE_URL, NUXT_SUPABASE_SERVICE_KEY)
 *      Either via .env.local or export before running.
 *   2. Supabase must be running (local: bun run db:start)
 *   3. Migrations applied (bun run db:reset or supabase db push)
 *   4. Fill in scripts/target-manifest.csv (copy from target-manifest-template.csv)
 *   5. Create a Storage bucket named 'targets' (public: false).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.NUXT_SUPABASE_SERVICE_KEY
const MANIFEST     = resolve(import.meta.dirname, 'target-manifest.csv')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing env vars: NUXT_PUBLIC_SUPABASE_URL or NUXT_SUPABASE_SERVICE_KEY')
  process.exit(1)
}

if (!existsSync(MANIFEST)) {
  console.error(`❌  Manifest not found at ${MANIFEST}`)
  console.error('    Copy target-manifest-template.csv → target-manifest.csv and fill it in.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const VALID_CATEGORIES = new Set(['land', 'water', 'structure', 'motion', 'life', 'energy'])

function parseCSV(content: string) {
  const lines = content.trim().split('\n')
  const headers = lines[0]!.split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

async function run() {
  const csvContent = readFileSync(MANIFEST, 'utf-8')
  const rows = parseCSV(csvContent)

  console.log(`📋  Found ${rows.length} images in manifest.\n`)

  let seeded = 0
  let skipped = 0

  for (const row of rows) {
    const file       = row.file!.trim()
    const category   = row.category!.trim()
    const license    = row.license!.trim()
    const attributes = (row.attributes ?? '').split(';').map((a) => a.trim()).filter(Boolean)
    const caption    = (row.caption ?? '').trim() || null

    // Validate required fields
    if (!file) { console.warn(`⚠️  Skipping row — missing file path`); skipped++; continue }
    if (!VALID_CATEGORIES.has(category)) {
      console.error(`❌  ABORT: category '${category}' is invalid for file '${file}'.`)
      console.error(`    Valid: ${[...VALID_CATEGORIES].join(', ')}`)
      process.exit(1)
    }
    // Hard-fail on missing license — do not insert unlicensed images
    if (!license) {
      console.error(`❌  ABORT: license is missing for '${file}'.`)
      console.error('    Every image must have a verified license string. Add it to the manifest.')
      process.exit(1)
    }

    const filePath = resolve(import.meta.dirname, '..', file)
    if (!existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}. Skipping.`)
      skipped++
      continue
    }

    // Upload to storage
    const storagePath = `${category}/${Date.now()}_${file.replace(/.*\//, '')}`
    const fileBuffer = readFileSync(filePath)
    const mimeType = getMime(filePath)

    const { error: uploadErr } = await db.storage
      .from('targets')
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false })

    if (uploadErr) {
      console.error(`❌  Upload failed for '${file}': ${uploadErr.message}`)
      skipped++
      continue
    }

    // Insert targets row
    const { error: insertErr } = await db.from('targets').insert({
      storage_path: storagePath,
      category,
      attributes,
      caption,
      license,
      active: true,
    })

    if (insertErr) {
      console.error(`❌  DB insert failed for '${file}': ${insertErr.message}`)
      skipped++
      continue
    }

    console.log(`✅  ${file} → ${storagePath} [${category}]`)
    seeded++
  }

  console.log(`\n🌱  Done. ${seeded} seeded · ${skipped} skipped.`)

  if (seeded < 4) {
    console.warn('\n⚠️  Pool has fewer than 4 images — sessions need at least 4 to run.')
  }
  if (seeded < 24) {
    console.warn('⚠️  Fewer than ~6 images per category — orthogonal selection may fall back to same-category decoys.')
  }
}

function getMime(path: string): string {
  const ext = extname(path).toLowerCase()
  return { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' }[ext] ?? 'image/jpeg'
}

run().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
