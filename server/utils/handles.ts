/** Public username format — letters, numbers, underscore; 3–20 chars. */
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

const ADJECTIVES = [
  'quiet', 'amber', 'deep', 'still', 'clear', 'soft', 'cold', 'vast',
  'faint', 'pale', 'dark', 'dim', 'wide', 'bare', 'calm', 'gray',
]

const NOUNS = [
  'cedar', 'basin', 'ridge', 'delta', 'field', 'mesa', 'shore', 'reach',
  'vale', 'creek', 'stone', 'heath', 'pass', 'dune', 'grove', 'plain',
]

export function generateHandle(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `${adj}_${noun}_${num}`
}

/**
 * Derive a default username from an email's local-part (e.g. `alex.k@x.com` →
 * `alex_k`). Disallowed chars collapse to `_`; returns null if the result can't
 * satisfy the username format (^[A-Za-z0-9_]{3,20}$), so callers fall back to a
 * generated handle.
 */
export function handleFromEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const local = email.split('@')[0] ?? ''
  const cleaned = local
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  if (cleaned.length < 3) return null
  return cleaned.slice(0, 20)
}

export function generateReferenceNumber(): string {
  const part1 = Math.floor(Math.random() * 9000) + 1000
  const part2 = Math.floor(Math.random() * 900) + 100
  return `${part1}—${part2}` // em-dash
}
