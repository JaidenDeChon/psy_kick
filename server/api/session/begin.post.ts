import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { generateReferenceNumber } from '../../utils/handles'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  // Pick a random active target
  const { data: targets, error: targetErr } = await db
    .from('targets')
    .select('id, category')
    .eq('active', true)

  if (targetErr || !targets || targets.length < 4) {
    throw createError({
      statusCode: 503,
      message: 'Not enough active targets in the pool. Add images via the seed script.',
    })
  }

  // Pick target at random
  const targetIndex = Math.floor(Math.random() * targets.length)
  const target = targets[targetIndex]!

  // Pick 3 decoys from different categories where possible
  const others = targets.filter((t) => t.id !== target.id)

  // Try to pick decoys from different categories (orthogonality rule)
  const categoryGroups: Record<string, typeof targets> = {}
  for (const t of others) {
    if (!categoryGroups[t.category]) categoryGroups[t.category] = []
    categoryGroups[t.category]!.push(t)
  }

  const decoys: typeof targets = []
  const categories = Object.keys(categoryGroups).filter((c) => c !== target.category)

  // Pick one from each distinct category first
  for (const cat of categories.sort(() => Math.random() - 0.5)) {
    if (decoys.length >= 3) break
    const pool = categoryGroups[cat]!
    decoys.push(pool[Math.floor(Math.random() * pool.length)]!)
  }

  // Fill remaining from any category if needed
  const usedIds = new Set([target.id, ...decoys.map((d) => d.id)])
  const remaining = others.filter((t) => !usedIds.has(t.id))
  while (decoys.length < 3 && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length)
    decoys.push(remaining[idx]!)
    remaining.splice(idx, 1)
  }

  if (decoys.length < 3) {
    throw createError({ statusCode: 503, message: 'Not enough images for orthogonal selection.' })
  }

  const referenceNumber = generateReferenceNumber()

  // Insert session
  const { data: session, error: sessionErr } = await db
    .from('sessions')
    .insert({
      user_id: user.id,
      target_id: target.id,
      reference_number: referenceNumber,
      status: 'capturing',
    })
    .select('id')
    .single()

  if (sessionErr || !session) {
    throw createError({ statusCode: 500, message: `Failed to create session: ${sessionErr?.message}` })
  }

  // Randomise slot order for all 4 candidates
  const allCandidates = [
    { image_id: target.id, is_target: true },
    ...decoys.map((d) => ({ image_id: d.id, is_target: false })),
  ].sort(() => Math.random() - 0.5)

  const candidateRows = allCandidates.map((c, i) => ({
    session_id: session.id,
    image_id: c.image_id,
    is_target: c.is_target,
    slot: i + 1,
  }))

  const { error: candErr } = await db.from('session_candidates').insert(candidateRows)
  if (candErr) {
    throw createError({ statusCode: 500, message: `Failed to insert candidates: ${candErr.message}` })
  }

  // Initialise perception + aol rows
  await db.from('session_perceptions').insert({ session_id: session.id })
  await db.from('session_aol').insert({ session_id: session.id })

  // Return ONLY session_id and reference_number — never target info
  return {
    session_id: session.id,
    reference_number: referenceNumber,
  }
})
