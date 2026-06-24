import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'
import { generateHandle } from '../../utils/handles'

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

  const handle = generateHandle()
  const { error } = await db
    .from('profiles')
    .insert({ id: user.id, handle })

  if (error) {
    throw createError({ statusCode: 500, message: `Failed to create profile: ${error.message}` })
  }

  return { handle }
})
