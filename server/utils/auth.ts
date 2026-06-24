import type { H3Event } from 'h3'
import { useUserClient } from './supabase'

export async function getServerUser(event: H3Event) {
  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing authorization token' })
  }

  const client = useUserClient(token)
  const { data: { user }, error } = await client.auth.getUser()

  if (error || !user) {
    throw createError({ statusCode: 401, message: 'Invalid or expired token' })
  }

  return { user, token }
}
