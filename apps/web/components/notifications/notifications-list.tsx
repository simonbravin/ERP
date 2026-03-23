'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format-utils'
import { NOTIFICATIONS_READ_EVENT } from '@/lib/notifications-events'
import { NOTIFICATIONS_UI_LIMIT } from '@/lib/notifications-constants'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/app/actions/notifications'

function notifyReadChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT))
  }
}

export function NotificationsList() {
  const t = useTranslations('common')
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { items: nextItems } = await getNotifications({ limit: NOTIFICATIONS_UI_LIMIT })
      setItems(nextItems)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleMarkRead(n: NotificationItem) {
    if (n.read) return
    await markNotificationRead(n.id)
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true, readAt: new Date() } : i)))
    notifyReadChanged()
    router.refresh()
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((i) => ({ ...i, read: true, readAt: new Date() })))
      notifyReadChanged()
      router.refresh()
    } finally {
      setMarkingAll(false)
    }
  }

  if (loading && items.length === 0) {
    return (
      <>
        <div className="erp-header-row">
          <div className="erp-section-header">
            <h1 className="erp-page-title">{t('notifications', { defaultValue: 'Notificaciones' })}</h1>
            <p className="erp-section-desc">
              {t('notificationsSubtitle', {
                defaultValue: 'Todas tus notificaciones con fecha y autor cuando aplique',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Cargando…' })}</p>
        </div>
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <div className="erp-header-row">
          <div className="erp-section-header">
            <h1 className="erp-page-title">{t('notifications', { defaultValue: 'Notificaciones' })}</h1>
            <p className="erp-section-desc">
              {t('notificationsSubtitle', {
                defaultValue: 'Todas tus notificaciones con fecha y autor cuando aplique',
              })}
            </p>
          </div>
        </div>
        <div className="erp-card p-12 text-center">
          <p className="text-muted-foreground">{t('noNotifications', { defaultValue: 'No hay notificaciones' })}</p>
        </div>
      </>
    )
  }

  const rowBase = 'flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50'
  const rowUnread = 'border-l-[3px] border-l-primary bg-muted/40 pl-[13px]'

  return (
    <>
      <div className="erp-header-row">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('notifications', { defaultValue: 'Notificaciones' })}</h1>
          <p className="erp-section-desc">
            {t('notificationsSubtitle', {
              defaultValue: 'Todas tus notificaciones con fecha y autor cuando aplique',
            })}
          </p>
        </div>
        <div className="erp-header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll || items.every((i) => i.read)}
          >
            {markingAll
              ? t('loading', { defaultValue: 'Cargando…' })
              : t('markAllRead', { defaultValue: 'Marcar todas como leídas' })}
          </Button>
        </div>
      </div>

      <div className="erp-card overflow-hidden shadow-[var(--shadow-card)]">
        <ul className="max-h-[min(70vh,28rem)] divide-y divide-border overflow-y-auto [scrollbar-width:thin]">
          {items.map((n) => (
            <li key={n.id}>
              {n.link ? (
                <Link
                  href={n.link}
                  className={`${rowBase} ${!n.read ? rowUnread : ''}`}
                  onClick={() => void handleMarkRead(n)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className={`text-sm ${n.read ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                      {n.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                  </div>
                  {n.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  )}
                  {n.actorName && (
                    <p className="text-xs text-muted-foreground">
                      {t('by', { defaultValue: 'Por' })} {n.actorName}
                    </p>
                  )}
                </Link>
              ) : (
                <div
                  className={`${rowBase} ${!n.read ? rowUnread : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleMarkRead(n)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleMarkRead(n)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className={`text-sm ${n.read ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                      {n.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                  </div>
                  {n.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  )}
                  {n.actorName && (
                    <p className="text-xs text-muted-foreground">
                      {t('by', { defaultValue: 'Por' })} {n.actorName}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
