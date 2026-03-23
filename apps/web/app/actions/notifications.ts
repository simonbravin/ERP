'use server'

import { prisma, type Prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { NOTIFICATIONS_UI_LIMIT } from '@/lib/notifications-constants'

export type NotificationItem = {
  id: string
  category: string
  title: string
  message: string
  read: boolean
  readAt: Date | null
  createdAt: Date
  actorName: string | null
  link?: string | null
}

/**
 * Get notifications for the current user (recipient).
 * Used for dropdown preview and full notifications page.
 */
export async function getNotifications(options?: {
  limit?: number
  cursor?: string
  unreadOnly?: boolean
}): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const session = await getSession()
  if (!session?.user?.id) return { items: [], nextCursor: null }

  const limit = options?.limit ?? NOTIFICATIONS_UI_LIMIT
  const items = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      type: 'IN_APP',
      ...(options?.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      category: true,
      title: true,
      message: true,
      read: true,
      readAt: true,
      createdAt: true,
      metadata: true,
      actor: { select: { fullName: true } },
    },
  })

  const hasMore = items.length > limit
  const slice = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null

  const linkFromMetadata = (m: unknown): string | null => {
    if (m && typeof m === 'object' && 'link' in m && typeof (m as { link: unknown }).link === 'string') {
      return (m as { link: string }).link
    }
    return null
  }

  return {
    items: slice.map((n) => ({
      id: n.id,
      category: n.category,
      title: n.title,
      message: n.message,
      read: n.read,
      readAt: n.readAt,
      createdAt: n.createdAt,
      actorName: n.actor?.fullName ?? null,
      link: linkFromMetadata(n.metadata),
    })),
    nextCursor,
  }
}

/**
 * Last N notifications for the header dropdown (same limit as the list page).
 */
export async function getNotificationsPreview(
  limit: number = NOTIFICATIONS_UI_LIMIT
): Promise<NotificationItem[]> {
  const { items } = await getNotifications({ limit })
  return items
}

/**
 * Count unread notifications for the current user (for badge).
 */
export async function getUnreadCount(): Promise<number> {
  const session = await getSession()
  if (!session?.user?.id) return 0

  return prisma.notification.count({
    where: {
      userId: session.user.id,
      type: 'IN_APP',
      read: false,
    },
  })
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: { read: true, readAt: new Date() },
  })
  return { success: true }
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllNotificationsRead(): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, type: 'IN_APP', read: false },
    data: { read: true, readAt: new Date() },
  })
  return { success: true }
}

// ---------------------------------------------------------------------------
// Create notifications (used by other server flows; no session required)
// ---------------------------------------------------------------------------

export type CreateNotificationParams = {
  orgId: string
  userId: string
  actorUserId?: string | null
  category: string
  title: string
  message: string
  /** Stored as JSON; use only Prisma-serializable values (e.g. `{ link: "/projects/..." }`). */
  metadata?: Prisma.JsonObject
}

/**
 * Create one IN_APP notification. Call from inventory, CO, certifications, etc.
 */
export async function createInAppNotification(params: CreateNotificationParams): Promise<void> {
  await prisma.notification.create({
    data: {
      orgId: params.orgId,
      userId: params.userId,
      actorUserId: params.actorUserId ?? null,
      type: 'IN_APP',
      category: params.category,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? undefined,
    },
  })
}

/**
 * Create IN_APP notifications for multiple users (e.g. all org members or approvers).
 */
export async function createInAppNotificationsForUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      orgId: params.orgId,
      userId,
      actorUserId: params.actorUserId ?? null,
      type: 'IN_APP',
      category: params.category,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? undefined,
    })),
  })
}
