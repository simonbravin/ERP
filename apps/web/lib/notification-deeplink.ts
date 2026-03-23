import type { Prisma } from '@repo/database'

/**
 * Canonical shape for IN_APP notification metadata (see `Notification.metadata` JSON).
 * Paths are locale-agnostic; `Link` / `router` from next-intl add the locale prefix.
 */
export function notificationDeepLinkMetadata(appPath: string): Prisma.JsonObject {
  if (!appPath.startsWith('/')) {
    throw new Error(`notificationDeepLinkMetadata: path must start with /, got ${JSON.stringify(appPath)}`)
  }
  return { link: appPath }
}
