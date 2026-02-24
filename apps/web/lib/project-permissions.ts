/**
 * Project-level permissions by role.
 * Used to limit visibility and edit access per area within a project.
 * Values in DB remain MANAGER | SUPERINTENDENT | VIEWER (SUPERINTENDENT = "Jefe de obra" in UI).
 */

import { prisma } from '@repo/database'
import type { OrgContext } from '@/lib/org-context'
import { isRestrictedToProjects } from '@/lib/org-context'

export type ProjectRole = 'MANAGER' | 'SUPERINTENDENT' | 'VIEWER'

/** Areas under /projects/[id]/... that can be gated by project role */
export const PROJECT_AREAS = {
  OVERVIEW: 'overview',
  DASHBOARD: 'dashboard',
  BUDGET: 'budget',
  SCHEDULE: 'schedule',
  DAILY_REPORTS: 'dailyReports',
  FINANCE: 'finance',
  TEAM: 'team',
  INVENTORY: 'inventory',
  SUPPLIERS: 'suppliers',
  DOCUMENTS: 'documents',
  QUALITY: 'quality',
  REPORTS: 'reports',
} as const

export type ProjectArea = (typeof PROJECT_AREAS)[keyof typeof PROJECT_AREAS]

type AreaPermission = 'view' | 'edit'

/** Matrix: projectRole -> area -> permissions (view and/or edit) */
const PROJECT_ROLE_AREA_PERMISSIONS: Record<
  ProjectRole,
  Partial<Record<ProjectArea, AreaPermission[]>>
> = {
  MANAGER: {
    overview: ['view', 'edit'],
    dashboard: ['view', 'edit'],
    budget: ['view', 'edit'],
    schedule: ['view', 'edit'],
    dailyReports: ['view', 'edit'],
    finance: ['view', 'edit'],
    team: ['view', 'edit'],
    inventory: ['view', 'edit'],
    suppliers: ['view', 'edit'],
    documents: ['view', 'edit'],
    quality: ['view', 'edit'],
    reports: ['view', 'edit'],
  },
  SUPERINTENDENT: {
    overview: ['view', 'edit'],
    dashboard: ['view', 'edit'],
    budget: ['view', 'edit'],
    schedule: ['view', 'edit'],
    dailyReports: ['view', 'edit'],
    finance: ['view', 'edit'],
    team: ['view'], // Jefe de obra: only view project team, cannot edit
    inventory: ['view', 'edit'],
    suppliers: ['view', 'edit'],
    documents: ['view', 'edit'],
    quality: ['view', 'edit'],
    reports: ['view', 'edit'],
  },
  VIEWER: {
    overview: ['view'],
    dashboard: ['view'],
    budget: ['view'],
    schedule: ['view'],
    dailyReports: ['view'],
    finance: ['view'],
    team: ['view'],
    inventory: ['view'],
    suppliers: ['view'],
    documents: ['view'],
    quality: ['view'],
    reports: ['view'],
  },
}

/** Check if project role can view this area (for sidebar and route access) */
export function canAccessProjectArea(
  projectRole: string | null | undefined,
  area: ProjectArea
): boolean {
  if (!projectRole || !isProjectRole(projectRole)) return false
  const perms = PROJECT_ROLE_AREA_PERMISSIONS[projectRole as ProjectRole][area]
  return perms?.includes('view') ?? false
}

/** Check if project role can edit in this area (for buttons and mutations) */
export function canEditProjectArea(
  projectRole: string | null | undefined,
  area: ProjectArea
): boolean {
  if (!projectRole || !isProjectRole(projectRole)) return false
  const perms = PROJECT_ROLE_AREA_PERMISSIONS[projectRole as ProjectRole][area]
  return perms?.includes('edit') ?? false
}

function isProjectRole(value: string): value is ProjectRole {
  return value === 'MANAGER' || value === 'SUPERINTENDENT' || value === 'VIEWER'
}

/** Human-readable labels for project roles (Argentina) */
export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  MANAGER: 'Gestor de proyecto',
  SUPERINTENDENT: 'Jefe de obra',
  VIEWER: 'Solo lectura',
}

/**
 * Asserts the current user has access to the project and returns their project role.
 * - OWNER/ADMIN/ACCOUNTANT or not restricted: project must belong to org; returns projectRole from ProjectMember or null.
 * - Restricted (EDITOR/VIEWER with restrictedToProjects): must be ProjectMember; throws if not.
 * @throws Error if access is denied
 */
export async function assertProjectAccess(
  projectId: string,
  ctx: OrgContext
): Promise<{ projectRole: string | null }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!project) throw new Error('Proyecto no encontrado')

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_orgMemberId: { projectId, orgMemberId: ctx.memberId },
    },
    select: { projectRole: true },
  })

  if (isRestrictedToProjects(ctx)) {
    if (!membership) throw new Error('No tenés acceso a este proyecto')
    return { projectRole: membership.projectRole }
  }

  return { projectRole: membership?.projectRole ?? null }
}
