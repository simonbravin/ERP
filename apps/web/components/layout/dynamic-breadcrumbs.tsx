'use client'

import { usePathname } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { ChevronRight, Home } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'nav.dashboard',
  projects: 'nav.projects',
  finance: 'nav.finance',
  transactions: 'nav.transactions',
  resources: 'nav.resources',
  settings: 'nav.settings',
  wbs: 'wbs.title',
  budget: 'nav.budget',
  'change-orders': 'changeOrders.title',
  certifications: 'nav.certifications',
  documents: 'nav.documents',
  inventory: 'nav.inventory',
  movements: 'inventory.movements',
  items: 'inventory.items',
  locations: 'inventory.locations',
  quality: 'nav.quality',
  reports: 'nav.reports',
  suppliers: 'nav.suppliers',
  team: 'nav.team',
  permissions: 'nav.permissions',
  clients: 'suppliers.typeClients',
  schedule: 'nav.schedule',
  rfis: 'nav.rfis',
  submittals: 'nav.submittals',
  'daily-reports': 'nav.dailyReports',
  new: 'common.create',
  edit: 'common.edit',
}

/**
 * Dynamic breadcrumbs that adapt to the current route
 * Returns null on dashboard page (no breadcrumbs needed)
 */
export function DynamicBreadcrumbs() {
  const pathname = usePathname()
  const t = useTranslations()
  
  // Remove locale from path (handles /es, /en, etc.)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  const segments = pathWithoutLocale.split('/').filter(Boolean)
  
  // Don't show breadcrumbs on dashboard
  if (segments.length === 0 || segments[0] === 'dashboard') {
    return null
  }
  
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    
    // Translate known segments, keep UUIDs as-is
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
    const labelKey = SEGMENT_LABELS[segment]
    const label = isUUID ? '...' : (labelKey ? t(labelKey) : segment)
    
    return { label, href, isLast: index === segments.length - 1 }
  })
  
  return (
    <nav 
      className="flex items-center text-sm text-slate-600" 
      aria-label="Breadcrumb"
    >
      {/* Home link */}
      <Link 
        href="/dashboard" 
        className="flex-shrink-0 p-1 transition-colors hover:text-slate-900"
        aria-label="Inicio"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {/* Breadcrumb items */}
      {breadcrumbs.map((crumb, i) => (
        <div key={i} className="flex items-center">
          <ChevronRight className="mx-1 h-4 w-4 flex-shrink-0 text-slate-400" />
          {crumb.isLast ? (
            <span className="font-medium text-slate-900">{crumb.label}</span>
          ) : (
            <Link 
              href={crumb.href} 
              className="transition-colors hover:text-slate-900 hover:underline"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
