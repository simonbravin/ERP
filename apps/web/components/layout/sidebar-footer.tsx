'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationsDropdown } from './notifications-dropdown'
import { UserMenuDropdown } from './user-menu-dropdown'

interface SidebarFooterProps {
  user: { name: string; email?: string | null }
  collapsed?: boolean
}

/**
 * Sidebar footer: notifications, theme toggle, settings link, and user profile.
 * Used at the bottom of both GlobalSidebar and ProjectSidebar.
 */
export function SidebarFooter({ user, collapsed = false }: SidebarFooterProps) {
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')

  return (
    <div className="flex flex-col border-t border-sidebar-border">
      <div className={cn('flex flex-col gap-0.5 px-2 py-2', collapsed && 'items-center px-1')}>
        <NotificationsDropdown
          label={collapsed ? undefined : tCommon('notifications', { defaultValue: 'Notificaciones' })}
          triggerClassName={cn('hover:bg-sidebar-accent text-sidebar-muted', collapsed && 'w-full justify-center')}
        />
        <ThemeToggle
          label={collapsed ? undefined : t('theme', { defaultValue: 'Tema' })}
          className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
        />
      </div>
      <div className={cn('border-t border-sidebar-border px-3 py-1.5', collapsed && 'flex justify-center px-2')}>
        <UserMenuDropdown user={user} variant="sidebar" collapsed={collapsed} />
      </div>
    </div>
  )
}
