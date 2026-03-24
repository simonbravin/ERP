'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { usePathname } from 'next/navigation'
import { Building2, User, Users, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsTabsProps {
  userRole: string
}

export function SettingsTabs({ userRole }: SettingsTabsProps) {
  const t = useTranslations('settings')
  const pathname = usePathname()

  const tabs = [
    {
      name: t('organization'),
      href: '/settings/organization',
      icon: Building2,
      roles: ['ADMIN', 'OWNER'],
    },
    {
      name: t('profile'),
      href: '/settings/profile',
      icon: User,
      roles: ['VIEWER', 'ACCOUNTANT', 'EDITOR', 'ADMIN', 'OWNER'],
    },
    {
      name: t('team'),
      href: '/settings/team',
      icon: Users,
      roles: ['ADMIN', 'OWNER'],
    },
    {
      name: t('subscription', { defaultValue: 'Suscripción' }),
      href: '/settings/subscription',
      icon: CreditCard,
      roles: ['ADMIN', 'OWNER'],
    },
  ]

  const visibleTabs = tabs.filter((tab) => tab.roles.includes(userRole))

  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex space-x-8">
        {visibleTabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
