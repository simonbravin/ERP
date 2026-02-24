'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  BarChart3,
  DollarSign,
  Calendar,
  Receipt,
  CheckSquare,
  FileText,
  ClipboardList,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
  Package,
  X,
  Home,
} from 'lucide-react'
import { SidebarFooter } from './sidebar-footer'
import {
  canAccessProjectArea,
  PROJECT_AREAS,
  type ProjectArea,
} from '@/lib/project-permissions'

interface ProjectSidebarProps {
  projectId: string
  orgName?: string
  orgLogoUrl?: string | null
  user: { name: string; email?: string | null }
  isMobile?: boolean
  sidebarOpen?: boolean
  onSidebarClose?: () => void
  collapsed?: boolean
  onCollapseToggle?: () => void
}

type ProjectSectionKey = 'vision' | 'planning' | 'resources' | 'quality'

interface NavItemChild {
  name: string
  href: string
  children?: { name: string; href: string }[]
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  sectionKey: ProjectSectionKey
  projectArea: ProjectArea
  children?: NavItemChild[]
}

const PROJECT_SECTION_ORDER: ProjectSectionKey[] = ['vision', 'planning', 'resources', 'quality']

/**
 * Project-specific sidebar
 * Shows: Project Dashboard, Budget, Schedule, Finance, Quality, etc.
 */
export function ProjectSidebar({ projectId, orgName = 'Bloqer', orgLogoUrl, user, isMobile = false, sidebarOpen = false, onSidebarClose, collapsed = false, onCollapseToggle }: ProjectSidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [projectName, setProjectName] = useState('Proyecto')
  const [projectRole, setProjectRole] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  
  // Fetch project name
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setProjectName(data.name || data.projectNumber || 'Proyecto'))
      .catch(() => setProjectName('Proyecto'))
  }, [projectId])

  // Fetch current user's project role for nav filtering
  useEffect(() => {
    fetch(`/api/projects/${projectId}/my-role`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setProjectRole(data.projectRole ?? null))
      .catch(() => setProjectRole(null))
  }, [projectId])

  const allNavigation: NavItem[] = useMemo(() => [
    { name: t('overview'), href: `/projects/${projectId}`, icon: LayoutDashboard, exact: true, sectionKey: 'vision', projectArea: PROJECT_AREAS.OVERVIEW },
    { name: t('projectDashboard'), href: `/projects/${projectId}/dashboard`, icon: BarChart3, sectionKey: 'vision', projectArea: PROJECT_AREAS.DASHBOARD },
    {
      name: t('budget'),
      href: `/projects/${projectId}/budget`,
      icon: DollarSign,
      sectionKey: 'planning',
      projectArea: PROJECT_AREAS.BUDGET,
      children: [
        { name: t('budgetVersions', { defaultValue: 'Versiones' }), href: `/projects/${projectId}/budget` },
        { name: t('budgetApproved', { defaultValue: 'Aprobado' }), href: `/projects/${projectId}/budget/approved` },
        { name: t('budgetMaterials', { defaultValue: 'Materiales' }), href: `/projects/${projectId}/budget/materials` },
      ],
    },
    { name: t('schedule'), href: `/projects/${projectId}/schedule`, icon: Calendar, sectionKey: 'planning', projectArea: PROJECT_AREAS.SCHEDULE },
    { name: t('dailyReports'), href: `/projects/${projectId}/daily-reports`, icon: ClipboardList, sectionKey: 'planning', projectArea: PROJECT_AREAS.DAILY_REPORTS },
    {
      name: t('finance'),
      href: `/projects/${projectId}/finance`,
      icon: Receipt,
      sectionKey: 'planning',
      projectArea: PROJECT_AREAS.FINANCE,
      children: [
        { name: t('transactions'), href: `/projects/${projectId}/finance/transactions` },
        { name: t('accountsPayable'), href: `/projects/${projectId}/finance/accounts-payable` },
        { name: t('accountsReceivable'), href: `/projects/${projectId}/finance/accounts-receivable` },
        { name: t('overhead', { defaultValue: 'Generales' }), href: `/projects/${projectId}/finance/overhead` },
        { name: t('purchaseOrders', { defaultValue: 'Órdenes de compra' }), href: `/projects/${projectId}/finance/purchase-orders` },
        { name: t('navCash', { defaultValue: 'Caja' }), href: `/projects/${projectId}/finance/cashflow` },
        { name: t('certifications'), href: `/projects/${projectId}/finance/certifications` },
      ],
    },
    { name: t('projectTeam', { defaultValue: 'Equipo del Proyecto' }), href: `/projects/${projectId}/team`, icon: Users, sectionKey: 'resources', projectArea: PROJECT_AREAS.TEAM },
    { name: t('inventory', { defaultValue: 'Inventario' }), href: `/projects/${projectId}/inventory`, icon: Package, sectionKey: 'resources', projectArea: PROJECT_AREAS.INVENTORY },
    { name: t('projectSuppliers'), href: `/projects/${projectId}/suppliers`, icon: Building2, sectionKey: 'resources', projectArea: PROJECT_AREAS.SUPPLIERS },
    { name: t('documents'), href: `/projects/${projectId}/documents`, icon: FileText, sectionKey: 'resources', projectArea: PROJECT_AREAS.DOCUMENTS },
    {
      name: t('quality'),
      href: `/projects/${projectId}/quality`,
      icon: CheckSquare,
      sectionKey: 'quality',
      projectArea: PROJECT_AREAS.QUALITY,
      children: [
        { name: t('rfis'), href: `/projects/${projectId}/quality/rfis` },
        { name: t('submittals'), href: `/projects/${projectId}/quality/submittals` },
      ],
    },
    { name: t('reports'), href: `/projects/${projectId}/reports`, icon: BarChart3, sectionKey: 'quality', projectArea: PROJECT_AREAS.REPORTS },
  ], [projectId, t])

  // Filter nav by project role (when user is project member); null role = show all
  const navigation = useMemo(() => {
    if (projectRole === null) return allNavigation
    return allNavigation.filter((item) => canAccessProjectArea(projectRole, item.projectArea))
  }, [allNavigation, projectRole])

  const projectSectionLabels: Record<ProjectSectionKey, string> = {
    vision: t('sectionProjectVision'),
    planning: t('sectionProjectManagement'),
    resources: t('sectionResources'),
    quality: t('sectionQuality'),
  }
  const bySection = PROJECT_SECTION_ORDER.reduce<Record<string, NavItem[]>>((acc, key) => {
    acc[key] = navigation.filter((item) => item.sectionKey === key)
    return acc
  }, {} as Record<string, NavItem[]>)

  const toggleSection = (href: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(href)) {
        next.delete(href)
      } else {
        next.add(href)
      }
      return next
    })
  }
  
  // Auto-expand sections based on current path (only update when adding a new section to avoid loops)
  useEffect(() => {
    const activeSection = navigation.find(item =>
      item.children && pathname.startsWith(item.href)
    )
    if (activeSection) {
      setExpandedSections(prev => {
        if (prev.has(activeSection.href)) return prev
        return new Set(prev).add(activeSection.href)
      })
    }
  }, [pathname, navigation])

  const closeOnNav = isMobile ? onSidebarClose : undefined
  const widthClass = collapsed ? 'w-16' : 'w-64'

  const asideContent = (
    <aside className={`flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ${widthClass}`}>
      {/* Logo/org name (or Home when collapsed) + back to projects + collapse/close */}
      <div className={cn('flex h-14 items-center justify-between border-b border-sidebar-border py-0.5', collapsed ? 'px-1.5 gap-1' : 'px-2 gap-2')}>
        {collapsed ? (
          <Link
            href="/dashboard"
            onClick={closeOnNav}
            className="flex h-8 w-8 flex-1 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title={t('dashboard')}
          >
            <Home className="h-5 w-5" />
          </Link>
        ) : (
          <Link href="/dashboard" onClick={closeOnNav} className="flex min-w-0 flex-1 items-center gap-2">
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt={orgName}
                className="h-[3.25rem] w-auto max-w-[140px] object-contain"
              />
            ) : (
              <span className="truncate text-base font-bold text-sidebar-foreground" title={orgName}>
                {orgName}
              </span>
            )}
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {!collapsed && (
            <Link
              href="/projects"
              onClick={closeOnNav}
              className="flex items-center gap-1.5 text-xs text-sidebar-muted transition-colors hover:text-sidebar-foreground"
              title={t('backToProjects')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          {isMobile ? (
            <button
              type="button"
              onClick={onSidebarClose}
              className="rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCollapseToggle}
              className={cn('rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground', collapsed ? 'p-1.5' : 'p-2')}
              aria-label={collapsed ? 'Expandir barra' : 'Contraer barra'}
              title={collapsed ? 'Expandir barra' : 'Contraer barra'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>
      
      {/* Project name (hidden when collapsed) — compact to avoid sidebar scroll */}
      {!collapsed && (
        <div className="border-b border-sidebar-border px-4 py-2">
          <h2 className="truncate text-base font-semibold text-sidebar-foreground" title={projectName}>
            {projectName}
          </h2>
        </div>
      )}
      
      {/* Navigation by section */}
      <nav className={cn('sidebar-nav-scroll flex-1 space-y-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
        {PROJECT_SECTION_ORDER.map((sectionKey) => {
          const items = bySection[sectionKey]
          if (!items.length) return null
          const label = projectSectionLabels[sectionKey]
          return (
            <div key={sectionKey} className={cn(collapsed ? 'mb-2' : 'mb-4')}>
              {!collapsed && (
                <div className="mb-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {label}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href) || pathname === item.href
                  const isExpanded = expandedSections.has(item.href)
                  const hasChildren = item.children && item.children.length > 0

                  if (collapsed) {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeOnNav}
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

                  return (
                    <div key={item.href}>
                      <div className="flex items-center">
                        <Link
                          href={item.href}
                          onClick={closeOnNav}
                          className={cn(
                            'flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-foreground'
                              : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground'
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </Link>
                        {hasChildren && (
                          <button
                            onClick={() => toggleSection(item.href)}
                            className="ml-1 rounded p-1 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="sidebar-children mt-1 space-y-1">
                          {item.children!.map((child) => {
                            const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                            const hasNested = child.children && child.children.length > 0
                            if (hasNested) {
                              return (
                                <div key={child.href} className="space-y-0.5">
                                  <Link
                                    href={child.href}
                                    onClick={closeOnNav}
                                    className={cn(
                                      'block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                      childActive
                                        ? 'text-sidebar-foreground'
                                        : 'text-sidebar-muted hover:text-sidebar-foreground'
                                    )}
                                  >
                                    {child.name}
                                  </Link>
                                  <div className="sidebar-children-nested space-y-0.5">
                                    {child.children!.map((sub) => {
                                      const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                                      return (
                                        <Link
                                          key={sub.href}
                                          href={sub.href}
                                          onClick={closeOnNav}
                                          className={cn(
                                            'block rounded-lg px-3 py-1 text-sm transition-colors',
                                            subActive
                                              ? 'font-medium text-sidebar-foreground'
                                              : 'text-sidebar-muted hover:text-sidebar-foreground'
                                          )}
                                        >
                                          {sub.name}
                                        </Link>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={closeOnNav}
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
