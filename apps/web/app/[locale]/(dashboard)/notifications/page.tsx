import { getSession } from '@/lib/session'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { NotificationsList } from '@/components/notifications/notifications-list'

export default async function NotificationsPage() {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <NotificationsList />
    </div>
  )
}
