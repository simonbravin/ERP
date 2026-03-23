'use client'

import { usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Menu, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  orgName: string
  sidebarOpen?: boolean
  onSidebarToggle?: () => void
}

/** Maps path segments to a simple page title for the minimal header */
function usePageTitle(): string {
  const t = useTranslations('nav')
  const pathname = usePathname() ?? ''
  const base = pathname.replace(/^\/(es|en)/, '').split('?')[0]
  if (base === '/dashboard' || base === '') return t('dashboard')
  if (base === '/projects') return t('projects')
  if (base.startsWith('/projects/') && base.split('/').length <= 3) return t('overview')
  if (base.includes('/finance')) return t('finance')
  if (base.includes('/budget')) return t('budget')
  if (base.includes('/schedule')) return t('schedule')
  if (base.includes('/team')) return t('team')
  if (base.includes('/reports')) return t('reports')
  if (base.includes('/inventory')) return t('inventory')
  if (base.includes('/suppliers')) return t('suppliers')
  if (base.includes('/documents')) return t('documents')
  if (base.includes('/settings')) return t('settings')
  if (base.includes('/quality')) return t('quality')
  return t('dashboard')
}

/**
 * Minimal header: page title + search (+ hamburger on mobile).
 * User, notifications, theme, and settings live in the sidebar footer.
 */
export function DashboardHeader({ orgName: _orgName, sidebarOpen, onSidebarToggle }: DashboardHeaderProps) {
  const title = usePageTitle()
  const t = useTranslations('common')

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onSidebarToggle}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input bg-background md:hidden',
            'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
        <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          role="search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t('search', { defaultValue: 'Search...' })}</span>
        </div>
      </div>
    </header>
  )
}
