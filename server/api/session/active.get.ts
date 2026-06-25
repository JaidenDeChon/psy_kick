import { getServerUser } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  const db = useServiceRoleClient()

  const { data: session } = await db
    .from('sessions')
    .select('id, status, reference_number')
    .eq('user_id', user.id)
    .neq('status', 'revealed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { session: session ?? null }
})
