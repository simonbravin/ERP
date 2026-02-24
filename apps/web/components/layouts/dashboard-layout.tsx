import { DashboardShell } from '@/components/layouts/dashboard-shell'

interface DashboardLayoutProps {
  children: React.ReactNode
  orgName: string
  orgLogoUrl?: string | null
  user: { name: string; email?: string | null }
  /** When true (EDITOR/VIEWER restricted): sidebar shows only Dashboard + Projects */
  restrictedToProjects?: boolean
}

/**
 * Dashboard layout shell with dual navigation system
 * - Dynamic sidebar (user, notifications, theme, settings in sidebar footer)
 * - Minimal header: page title + search (+ hamburger on mobile)
 * - Mobile: sidebar as overlay drawer
 */
export function DashboardLayout({ children, orgName, orgLogoUrl, user, restrictedToProjects }: DashboardLayoutProps) {
  return (
    <DashboardShell orgName={orgName} orgLogoUrl={orgLogoUrl} user={user} restrictedToProjects={restrictedToProjects}>
      {children}
    </DashboardShell>
  )
}
