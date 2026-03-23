'use client'

import { usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BarChart3,
  Calculator,
  Calendar,
  DollarSign,
} from 'lucide-react'

interface ProjectTabsProps {
  projectId: string
  showScheduleTab?: boolean
}

/** Misma estética que el menú de Finanzas de empresa: barra redondeada, pestañas con íconos, activo con bg-card. */
export function ProjectTabs({ projectId, showScheduleTab = true }: ProjectTabsProps) {
  const pathname = usePathname()
  const t = useTranslations('nav')

  const tabs = [
    { name: t('overview'), href: `/projects/${projectId}`, icon: LayoutDashboard, exact: true },
    { name: t('projectDashboard'), href: `/projects/${projectId}/dashboard`, icon: BarChart3, exact: false },
    { name: t('budget'), href: `/projects/${projectId}/budget`, icon: Calculator, exact: false },
    ...(showScheduleTab
      ? [
          {
            name: t('schedule'),
            href: `/projects/${projectId}/schedule`,
            icon: Calendar,
            exact: false,
          },
        ]
      : []),
    { name: t('finance'), href: `/projects/${projectId}/finance`, icon: DollarSign, exact: false },
  ]

  return (
    <nav
      className="flex w-full flex-nowrap gap-1 overflow-x-auto rounded-lg border border-border bg-muted/50 p-1"
      aria-label="Tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{tab.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
