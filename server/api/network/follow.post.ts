import { getServerUser, requireCloudVerified } from '../../utils/auth'
import { useServiceRoleClient } from '../../utils/supabase'

/**
 * Follow / unfollow another operator. Both parties must be cloud + verified
 * (§1A). Self-follow is rejected. Idempotent. Identified by username (the public
 * identity) or by user_id.
 */
export default defineEventHandler(async (event) => {
  const { user } = await getServerUser(event)
  requireCloudVerified(user)

  const body = await readBody(event)
  const follow: boolean = body?.follow !== false // default true
  const db = useServiceRoleClient()

  // Resolve the followee — by explicit id or by username.
  let followeeId: string | undefined = body?.followee_id
  if (!followeeId && body?.username) {
    const { data } = await db
      .from('profiles')
      .select('id')
      .ilike('handle', body.username)
      .single()
    followeeId = data?.id
  }
  if (!followeeId) throw createError({ statusCode: 404, message: 'User not found' })
  if (followeeId === user.id) throw createError({ statusCode: 400, message: 'You cannot follow yourself' })

  if (!follow) {
    await db.from('follows').delete().eq('follower_id', user.id).eq('followee_id', followeeId)
    return { following: false }
  }

  // Both parties must be cloud + verified.
  const { data: ok } = await db.rpc('is_cloud_verified', { uid: followeeId })
  if (!ok) throw createError({ statusCode: 400, message: 'That user is not a public operator yet' })

  const { error } = await db
    .from('follows')
    .upsert({ follower_id: user.id, followee_id: followeeId }, { onConflict: 'follower_id,followee_id' })
  if (error) throw createError({ statusCode: 500, message: `Failed to follow: ${error.message}` })

  return { following: true }
})
