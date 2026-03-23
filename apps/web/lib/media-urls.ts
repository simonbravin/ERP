import { getDownloadUrl } from '@/lib/r2-client'

/** Resolve org logo URL from OrgProfile.logoStorageKey (presigned R2 or /uploads). */
export async function resolveLogoUrl(storageKey: string | null): Promise<string | null> {
  if (!storageKey) return null
  try {
    const url = await getDownloadUrl(storageKey)
    return url.startsWith('http') || url.startsWith('/') ? url : null
  } catch {
    return null
  }
}

/** Resolve user avatar for display (presigned when stored as r2:key). */
export async function resolveAvatarUrl(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith('r2:')) {
    try {
      const url = await getDownloadUrl(avatarUrl.slice(3))
      return url.startsWith('http') || url.startsWith('/') ? url : null
    } catch {
      return null
    }
  }
  return avatarUrl.startsWith('/') || avatarUrl.startsWith('http') ? avatarUrl : null
}
