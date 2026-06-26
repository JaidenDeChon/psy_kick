import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  // Every in-progress session (anything not yet revealed). Multiple may be
  // active at once — the client surfaces each so none get stranded.
  const { data: sessions } = await db
    .from('sessions')
    .select('id, status, reference_number, created_at')
    .eq('user_id', user.id)
    .neq('status', 'revealed')
    .order('created_at', { ascending: false })

  return { sessions: sessions ?? [] }
})
