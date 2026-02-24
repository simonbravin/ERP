'use client'

import { usePathname } from 'next/navigation'
import { GlobalSidebar } from './global-sidebar'
import { ProjectSidebar } from './project-sidebar'

// UUID v4 pattern to distinguish project IDs from route names
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface DynamicSidebarProps {
  orgName?: string
  orgLogoUrl?: string | null
  user: { name: string; email?: string | null }
  /** When true, global sidebar shows only Dashboard + Projects */
  restrictedToProjects?: boolean
  /** Mobile: sidebar as overlay drawer */
  isMobile?: boolean
  sidebarOpen?: boolean
  onSidebarClose?: () => void
  /** Desktop: collapsed = icons only */
  collapsed?: boolean
  onCollapseToggle?: () => void
}

/**
 * Detects current context and renders appropriate sidebar
 * - Global: For organization-wide navigation (dashboard, projects list, team, etc.)
 * - Project: For project-specific navigation (budget, certifications, etc.)
 * 
 * Project context is detected when:
 * - URL matches /projects/[uuid] or /projects/[uuid]/*
 * - The ID is a valid UUID (not 'new' or other route names)
 */
const SIDEBAR_WIDTH = 256
const SIDEBAR_COLLAPSED_WIDTH = 64

export function DynamicSidebar({
  orgName = 'Bloqer',
  orgLogoUrl,
  user,
  restrictedToProjects,
  isMobile = false,
  sidebarOpen = false,
  onSidebarClose,
  collapsed = false,
  onCollapseToggle,
}: DynamicSidebarProps) {
  const pathname = usePathname()

  const projectMatch = pathname.match(/\/projects\/([^\/]+)/)
  const projectId = projectMatch?.[1]
  const isProjectContext = projectId && UUID_REGEX.test(projectId)

  const mobileProps = isMobile
    ? { isMobile: true as const, sidebarOpen: sidebarOpen ?? false, onSidebarClose: onSidebarClose ?? (() => {}) }
    : { isMobile: false as const, sidebarOpen: undefined, onSidebarClose: undefined }
  const collapseProps = { collapsed: isMobile ? false : collapsed, onCollapseToggle: onCollapseToggle ?? (() => {}) }

  if (isProjectContext) {
    return (
      <ProjectSidebar
        projectId={projectId}
        orgName={orgName}
        orgLogoUrl={orgLogoUrl}
        user={user}
        {...mobileProps}
        {...collapseProps}
      />
    )
  }

  return (
    <GlobalSidebar
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      user={user}
      restrictedToProjects={restrictedToProjects}
      {...mobileProps}
      {...collapseProps}
    />
  )
}
