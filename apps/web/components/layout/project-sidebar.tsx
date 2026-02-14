'use client'

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
  FileCheck,
  FileText,
  ClipboardList,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Users,
} from 'lucide-react'

interface ProjectSidebarProps {
  projectId: string
  orgName?: string
  orgLogoUrl?: string | null
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  children?: { name: string; href: string }[]
}

/**
 * Project-specific sidebar
 * Shows: Project Dashboard, Budget, Schedule, Finance, Quality, etc.
 */
export function ProjectSidebar({ projectId, orgName = 'Construction ERP', orgLogoUrl }: ProjectSidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [projectName, setProjectName] = useState('Proyecto')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  
  // Fetch project name
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setProjectName(data.name || data.projectNumber || 'Proyecto'))
      .catch(() => setProjectName('Proyecto'))
  }, [projectId])

  // Memoize navigation so effect below doesn't see a new array every render (avoids update loops)
  const navigation: NavItem[] = useMemo(() => [
    {
      name: t('overview'),
      href: `/projects/${projectId}`,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: t('projectDashboard'),
      href: `/projects/${projectId}/dashboard`,
      icon: BarChart3,
    },
    {
      name: t('budget'),
      href: `/projects/${projectId}/budget`,
      icon: DollarSign,
    },
    {
      name: t('schedule'),
      href: `/projects/${projectId}/schedule`,
      icon: Calendar,
    },
    {
      name: t('finance'),
      href: `/projects/${projectId}/finance`,
      icon: Receipt,
      children: [
        {
          name: t('transactions'),
          href: `/projects/${projectId}/finance/transactions`,
        },
        {
          name: t('cashflow', { defaultValue: 'Flujo de caja' }),
          href: `/projects/${projectId}/finance/cashflow`,
        },
      ],
    },
    {
      name: t('certifications'),
      href: `/projects/${projectId}/certifications`,
      icon: FileCheck,
    },
    {
      name: t('reports'),
      href: `/projects/${projectId}/reports`,
      icon: BarChart3,
    },
    {
      name: t('projectTeam', { defaultValue: 'Equipo del Proyecto' }),
      href: `/projects/${projectId}/team`,
      icon: Users,
    },
    {
      name: t('quality'),
      href: `/projects/${projectId}/quality`,
      icon: CheckSquare,
      children: [
        {
          name: t('rfis'),
          href: `/projects/${projectId}/quality/rfis`,
        },
        {
          name: t('submittals'),
          href: `/projects/${projectId}/quality/submittals`,
        },
      ],
    },
    {
      name: t('dailyReports'),
      href: `/projects/${projectId}/daily-reports`,
      icon: ClipboardList,
    },
    {
      name: t('documents'),
      href: `/projects/${projectId}/documents`,
      icon: FileText,
    },
  ], [projectId, t])

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
  
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo/org name + back to projects */}
      <div className="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-2 py-0.5">
        <Link href="/dashboard" className="min-w-0 flex-1">
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
        <Link
          href="/projects"
          className="flex shrink-0 items-center gap-1.5 text-xs text-sidebar-muted transition-colors hover:text-sidebar-foreground"
          title={t('backToProjects')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
      
      {/* Project name */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="truncate text-lg font-semibold text-sidebar-foreground" title={projectName}>
          {projectName}
        </h2>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href
            : pathname.startsWith(item.href) || pathname === item.href
          const isExpanded = expandedSections.has(item.href)
          const hasChildren = item.children && item.children.length > 0
          
          return (
            <div key={item.name}>
              {/* Main item */}
              <div className="flex items-center">
                <Link
                  href={item.href}
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
                
                {/* Expand button for items with children */}
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
              
              {/* Sub-items */}
              {hasChildren && isExpanded && (
                <div className="ml-11 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
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
      </nav>
    </aside>
  )
}
