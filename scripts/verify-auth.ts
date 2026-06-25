/**
 * E2E verification of the anonymous → permanent upgrade path against LOCAL Supabase.
 *
 * Proves the one principle that governs the auth work (plan §2): the uid is
 * preserved when an anonymous user upgrades, so all practice history carries over.
 *
 * Drives the REAL flow: anonymous sign-in → updateUser(email,password) →
 * read the confirmation email out of Mailpit → follow the verify link →
 * assert is_anonymous flips false and the uid is unchanged → sign out →
 * sign back in with the password → assert the same uid.
 *
 * Run from repo root (Bun auto-loads .env):  bun run scripts/verify-auth.ts
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NUXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY!
const MAILPIT = 'http://127.0.0.1:54324'

if (!URL || !ANON) { console.error('Missing Supabase env vars'); process.exit(1) }

const email = `operator_${Date.now()}@example.com`
const password = 'correct-horse-7'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function findConfirmationLink(to: string): Promise<string | null> {
  // Mailpit REST: list messages, find the one addressed to `to`, pull its body.
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await fetch(`${MAILPIT}/api/v1/messages`).then(r => r.json()) as {
      messages: { ID: string; To: { Address: string }[] }[]
    }
    const msg = list.messages?.find(m => m.To?.some(t => t.Address.toLowerCase() === to.toLowerCase()))
    if (msg) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then(r => r.json()) as {
        HTML: string; Text: string
      }
      const body = `${full.HTML}\n${full.Text}`
      const m = body.match(/http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^"'\s<)]+/)
      return m ? m[0].replace(/&amp;/g, '&') : null
    }
    await new Promise(r => setTimeout(r, 250))
  }
  return null
}

const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log(`\nauth upgrade verification · ${email}\n`)

// 1 — anonymous sign-in
const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously()
check('anonymous sign-in succeeds', !anonErr && !!anon.user, anonErr?.message)
const uidAnon = anon.user?.id
check('anonymous user has is_anonymous = true', anon.user?.is_anonymous === true)
console.log(`    uid(anon) = ${uidAnon}`)

// 2 — attach email + password to the anonymous user (the "save my progress" upgrade)
const { data: upd, error: updErr } = await supabase.auth.updateUser({ email, password })
check('updateUser(email,password) succeeds', !updErr, updErr?.message)
console.log(`    is_anonymous after updateUser (pre-confirm) = ${upd.user?.is_anonymous}`)
console.log(`    email after updateUser = ${upd.user?.email ?? '(none yet)'} / new_email = ${(upd.user as any)?.new_email ?? '(n/a)'}`)

// 3 — confirm via the emailed link (Mailpit)
const link = await findConfirmationLink(email)
check('confirmation email arrived in Mailpit with a verify link', !!link)
if (link) {
  console.log(`    verify link = ${link.slice(0, 90)}...`)
  const res = await fetch(link, { redirect: 'manual' })
  check('following the verify link confirms (3xx redirect)', res.status >= 300 && res.status < 400, `HTTP ${res.status}`)
}

// 4 — refresh and assert the upgrade landed on the SAME uid
const { data: refreshed, error: refErr } = await supabase.auth.refreshSession()
check('session refresh after confirm succeeds', !refErr, refErr?.message)
const userAfter = refreshed.user
console.log(`    uid(after upgrade) = ${userAfter?.id}`)
check('uid is PRESERVED across upgrade', userAfter?.id === uidAnon, `${uidAnon} → ${userAfter?.id}`)
check('is_anonymous is now false', userAfter?.is_anonymous === false || userAfter?.is_anonymous == null && !!userAfter?.email)
check('email is now attached', userAfter?.email === email, userAfter?.email)

// 5 — sign out, then sign back in with the password
await supabase.auth.signOut()
const { data: signedIn, error: siErr } = await supabase.auth.signInWithPassword({ email, password })
check('sign-in with the new password succeeds', !siErr && !!signedIn.user, siErr?.message)
check('signed-in uid equals the original anonymous uid', signedIn.user?.id === uidAnon, `${uidAnon} → ${signedIn.user?.id}`)

console.log(`\n${failures === 0 ? 'ALL PASSED ✓' : `${failures} CHECK(S) FAILED ✗`}\n`)
process.exit(failures === 0 ? 0 : 1)
