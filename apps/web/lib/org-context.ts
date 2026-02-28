import { prisma } from '@repo/database'
import type { CustomPermissionsMap } from '@/lib/permissions'

const ROLES_SEE_ALL_PROJECTS = ['OWNER', 'ADMIN', 'ACCOUNTANT'] as const

export type OrgContext = {
  orgId: string
  orgName: string
  role: string
  memberId: string
  restrictedToProjects: boolean
  customPermissions: CustomPermissionsMap
}

/** True solo cuando el usuario es EDITOR o VIEWER y tiene restrictedToProjects = true. OWNER/ADMIN/ACCOUNTANT nunca están restringidos. */
export function isRestrictedToProjects(ctx: OrgContext): boolean {
  if (ROLES_SEE_ALL_PROJECTS.includes(ctx.role as (typeof ROLES_SEE_ALL_PROJECTS)[number])) {
    return false
  }
  return ctx.restrictedToProjects === true
}

/**
 * Devuelve los projectId que el usuario puede ver.
 * - null = puede ver todos los proyectos de la org (OWNER/ADMIN/ACCOUNTANT o no restringido).
 * - string[] = solo esos projectId (usuario restringido: solo proyectos donde es ProjectMember).
 */
export async function getVisibleProjectIds(ctx: OrgContext): Promise<string[] | null> {
  if (!isRestrictedToProjects(ctx)) return null
  const rows = await prisma.projectMember.findMany({
    where: { orgMemberId: ctx.memberId },
    select: { projectId: true },
  })
  return rows.map((r) => r.projectId)
}

export async function getOrgContext(userId: string): Promise<OrgContext | null> {
  const member = await prisma.orgMember.findFirst({
    where: { userId, active: true },
    select: {
      orgId: true,
      role: true,
      id: true,
      restrictedToProjects: true,
      customPermissions: true,
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  if (!member) return null
  return {
    orgId: member.orgId,
    orgName: member.organization.name,
    role: member.role,
    memberId: member.id,
    restrictedToProjects: member.restrictedToProjects ?? false,
    customPermissions: (member.customPermissions as CustomPermissionsMap) ?? null,
  }
}
