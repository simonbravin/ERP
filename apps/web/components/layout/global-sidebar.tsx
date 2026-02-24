'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Package,
  Building2,
  FileText,
  DollarSign,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
} from 'lucide-react'
import { SidebarFooter } from './sidebar-footer'

type NavModuleKey =
  | 'DASHBOARD'
  | 'PROJECTS'
  | 'REPORTS'
  | 'TEAM'
  | 'FINANCE'
  | 'INVENTORY'
  | 'DOCUMENTS'
  | 'SETTINGS'

interface NavChild {
  name: string
  href: string
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  module: NavModuleKey
  sectionKey: 'operations' | 'management' | 'reports' | 'system'
  children?: NavChild[]
}

interface GlobalSidebarProps {
  orgName?: string
  orgLogoUrl?: string | null
  user: { name: string; email?: string | null }
  /** When true, show only Tablero + Proyectos (restricted user) */
  restrictedToProjects?: boolean
  isMobile?: boolean
  sidebarOpen?: boolean
  onSidebarClose?: () => void
  collapsed?: boolean
  onCollapseToggle?: () => void
}

const GLOBAL_SECTION_ORDER = ['operations', 'management', 'reports'] as const

/**
 * Global sidebar for organization-wide navigation
 * Finance has an expandable submenu (Dashboard, Generales, Transacciones, etc.) like ProjectSidebar.
 */
export function GlobalSidebar({ orgName = 'Bloqer', orgLogoUrl, user, restrictedToProjects = false, isMobile = false, sidebarOpen = false, onSidebarClose, collapsed = false, onCollapseToggle }: GlobalSidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { canView, status, loading } = usePermissions()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (href: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  useEffect(() => {
    if (pathname === '/finance' || pathname.startsWith('/finance/')) {
      setExpandedSections((prev) => (prev.has('/finance') ? prev : new Set(prev).add('/finance')))
    }
  }, [pathname])

  const allNav: NavItem[] = useMemo(
    () => [
      { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard, module: 'DASHBOARD', sectionKey: 'operations' },
      { name: t('projects'), href: '/projects', icon: FolderKanban, module: 'PROJECTS', sectionKey: 'operations' },
      {
        name: t('finance'),
        href: '/finance',
        icon: DollarSign,
        module: 'FINANCE',
        sectionKey: 'operations',
        children: [
          { name: t('transactions'), href: '/finance/transactions' },
          { name: t('overhead'), href: '/finance/overhead' },
          { name: t('accountsPayable'), href: '/finance/accounts-payable' },
          { name: t('accountsReceivable'), href: '/finance/accounts-receivable' },
          { name: t('cashflow'), href: '/finance/cashflow' },
          { name: t('cashProjection'), href: '/finance/cash-projection' },
        ],
      },
      { name: t('team'), href: '/team', icon: Users, module: 'TEAM', sectionKey: 'management' },
      { name: t('inventory'), href: '/inventory', icon: Package, module: 'INVENTORY', sectionKey: 'management' },
      { name: t('suppliersAndClients'), href: '/suppliers', icon: Building2, module: 'PROJECTS', sectionKey: 'management' },
      { name: t('documents'), href: '/documents', icon: FileText, module: 'DOCUMENTS', sectionKey: 'management' },
      { name: t('reports'), href: '/reports', icon: BarChart3, module: 'REPORTS', sectionKey: 'reports' },
    ],
    [t]
  )

  const navigation = useMemo(() => {
    let list = status === 'loading' || loading ? allNav : allNav.filter((item) => canView(item.module))
    if (restrictedToProjects) {
      list = list.filter(
        (item) =>
          item.module === 'DASHBOARD' || (item.module === 'PROJECTS' && item.href === '/projects')
      )
    }
    return list
  }, [allNav, status, loading, restrictedToProjects])

  const sectionLabels: Record<string, string> = {
    operations: t('sectionOperations'),
    management: t('sectionManagement'),
    reports: t('sectionReports'),
  }
  const bySection = GLOBAL_SECTION_ORDER.reduce<Record<string, NavItem[]>>((acc, key) => {
    acc[key] = navigation.filter((item) => item.sectionKey === key)
    return acc
  }, {} as Record<string, NavItem[]>)

  const widthClass = collapsed ? 'w-16' : 'w-64'
  const asideContent = (
    <aside className={`flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ${widthClass}`}>
      {/* Logo or org name (or Home when collapsed) + collapse (desktop) / close (mobile) */}
      <div className={cn('flex h-14 items-center justify-between border-b border-sidebar-border py-0.5', collapsed ? 'px-1.5 gap-1' : 'px-2 gap-2')}>
        {collapsed ? (
          <Link
            href="/dashboard"
            onClick={isMobile ? onSidebarClose : undefined}
            className="flex h-8 w-8 flex-1 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title={t('dashboard')}
          >
            <Home className="h-5 w-5" />
          </Link>
        ) : (
          <Link href="/dashboard" onClick={isMobile ? onSidebarClose : undefined} className="flex min-w-0 flex-1 items-center gap-2">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt={orgName}
                className="h-[3.25rem] w-auto max-w-[180px] object-contain"
              />
            ) : (
              <span className="truncate text-lg font-bold text-sidebar-foreground" title={orgName}>
                {orgName}
              </span>
            )}
          </Link>
        )}
        {isMobile ? (
          <button
            type="button"
            onClick={onSidebarClose}
            className="shrink-0 rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onCollapseToggle}
            className={cn('shrink-0 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground', collapsed ? 'p-1.5' : 'p-2')}
            aria-label={collapsed ? 'Expandir barra' : 'Contraer barra'}
            title={collapsed ? 'Expandir barra' : 'Contraer barra'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        )}
      </div>
      
      {/* Navigation by section */}
      <nav className="sidebar-nav-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {GLOBAL_SECTION_ORDER.map((sectionKey) => {
          const items = bySection[sectionKey]
          if (!items.length) return null
          const label = sectionLabels[sectionKey]
          return (
            <div key={sectionKey} className={cn('mb-4', collapsed && 'mb-2')}>
              {!collapsed && (
                <div className="mb-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {label}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  const hasChildren = item.children && item.children.length > 0
                  const isExpanded = expandedSections.has(item.href)

                  if (collapsed) {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={isMobile ? onSidebarClose : undefined}
                        title={item.name}
                        className={cn(
                          'flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-foreground'
                            : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                      </Link>
                    )
                  }

                  if (hasChildren) {
                    return (
                      <div key={item.href}>
                        <div className="flex items-center">
                          <Link
                            href={item.href}
                            onClick={isMobile ? onSidebarClose : undefined}
                            className={cn(
                              'flex flex-1 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-sidebar-accent text-sidebar-foreground'
                                : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleSection(item.href)}
                            className="ml-1 shrink-0 rounded p-1 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="sidebar-children mt-1 space-y-1">
                            {item.children!.map((child) => {
                              const childActive =
                                pathname === child.href || pathname.startsWith(child.href + '/')
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={isMobile ? onSidebarClose : undefined}
                                  className={cn(
                                    'block rounded-lg px-3 py-1.5 text-sm transition-colors',
                                    childActive
                                      ? 'font-medium text-sidebar-foreground'
                                      : 'text-sidebar-muted hover:text-sidebar-foreground'
                                  )}
                                >
                                  {child.name}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={isMobile ? onSidebarClose : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
      
      {/* Footer: notifications, theme, settings, user */}
      <SidebarFooter user={user} collapsed={collapsed} />
    </aside>
  )

  if (isMobile) {
    return (
      <div className="w-0 shrink-0 overflow-visible md:w-64">
        <div
          role="presentation"
          aria-hidden
          onClick={onSidebarClose}
          className={`fixed inset-0 z-[998] bg-black/30 transition-opacity md:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        />
        <div
          className={`fixed inset-y-0 left-0 z-[999] w-64 transform transition-transform duration-300 ease-out md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {asideContent}
        </div>
      </div>
    )
  }

  return asideContent
}
