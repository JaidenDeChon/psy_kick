import type { SupabaseClient } from '@supabase/supabase-js'

export const PLACEHOLDER_STORAGE_PATH = 'placeholder'
export const PLACEHOLDER_URL = '/img/placeholder.svg'

/**
 * Returns a short-lived signed URL for a target image.
 * Falls back to the local placeholder if the path is 'placeholder'
 * or if Storage fails (missing file, bucket not yet set up, etc.).
 */
export async function getSignedImageUrl(
  db: SupabaseClient,
  storagePath: string,
  expiresIn: number
): Promise<string> {
  if (storagePath === PLACEHOLDER_STORAGE_PATH) {
    return PLACEHOLDER_URL
  }

  const { data, error } = await db.storage
    .from('targets')
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data?.signedUrl) {
    return PLACEHOLDER_URL
  }

  return data.signedUrl
}
