import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { generateHandle, handleFromEmail } from '../../utils/handles'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  const { data: existing } = await db
    .from('profiles')
    .select('id, handle')
    .eq('id', user.id)
    .single()

  if (existing) {
    return { handle: existing.handle }
  }

  // Prefer the email local-part (e.g. Google sign-in → "alex" from alex@…), then
  // fall back to random handles. The lower(handle) unique index makes each insert
  // the source of truth for availability, so we try candidates until one lands.
  const candidates: string[] = []
  const fromEmail = handleFromEmail(user.email)
  if (fromEmail) candidates.push(fromEmail)
  for (let i = 0; i < 5; i++) candidates.push(generateHandle())

  for (const handle of candidates) {
    const { error } = await db.from('profiles').insert({ id: user.id, handle })
    if (!error) return { handle }

    // 23505 = unique violation: either this id already got a profile (a concurrent
    // ensure won the race) or the handle is taken. Re-check our own row before
    // moving on; if it exists now, return it — otherwise try the next candidate.
    if (error.code === '23505') {
      const { data: now } = await db.from('profiles').select('handle').eq('id', user.id).single()
      if (now) return { handle: now.handle }
      continue
    }
    throw createError({ statusCode: 500, message: `Failed to create profile: ${error.message}` })
  }

  throw createError({ statusCode: 500, message: 'Failed to allocate a unique handle.' })
})
