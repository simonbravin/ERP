'use client'

import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { DynamicSidebar } from '@/components/layout/dynamic-sidebar'
import { BreadcrumbsContainer } from '@/components/layout/breadcrumbs-container'

const MOBILE_BP = 768

interface DashboardShellProps {
  children: React.ReactNode
  orgName: string
  orgLogoUrl?: string | null
  user: { name: string; email?: string | null }
  restrictedToProjects?: boolean
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`)
    setIsMobile(mq.matches)
    const handler = () => setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

/**
 * Client shell: holds mobile sidebar open state and desktop collapsed state.
 * On mobile, sidebar is an overlay drawer; on desktop it can be collapsed (icons only).
 * No top header bar: page titles live in each section; mobile gets a floating menu button to open the sidebar.
 */
export function DashboardShell({ children, orgName, orgLogoUrl, user, restrictedToProjects }: DashboardShellProps) {
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(orgLogoUrl ?? null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isMobile = useIsMobile()

  // Keep local state in sync if server ever provides a logo URL.
  useEffect(() => {
    setResolvedLogoUrl(orgLogoUrl ?? null)
  }, [orgLogoUrl])

  // Lazy-load org logo via API so navigation is not blocked by R2/DB calls.
  useEffect(() => {
    if (resolvedLogoUrl !== null) return
    let cancelled = false

    async function loadLogo() {
      try {
        const res = await fetch('/api/org/logo')
        if (!res.ok) return
        const data = (await res.json()) as { logoUrl?: string | null }
        if (!cancelled && data.logoUrl) {
          setResolvedLogoUrl(data.logoUrl)
        }
      } catch {
        // Ignore logo errors; sidebar will just show org initials/name.
      }
    }

    loadLogo()
    return () => {
      cancelled = true
    }
  }, [resolvedLogoUrl])

  return (
    <div className="flex h-screen w-full bg-background">
      <div className="flex h-full w-full min-w-0 overflow-hidden">
        <DynamicSidebar
          orgName={orgName}
          orgLogoUrl={resolvedLogoUrl}
          user={user}
          restrictedToProjects={restrictedToProjects}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          onSidebarClose={() => setSidebarOpen(false)}
          collapsed={!isMobile && sidebarCollapsed}
          onCollapseToggle={() => setSidebarCollapsed((v) => !v)}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile only: floating button to open sidebar when closed */}
          {isMobile && !sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background shadow-md hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          <BreadcrumbsContainer />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  )
}
