import { auth } from '@/lib/auth'
import {
  hasPermission,
  canAccess,
  MODULES,
  type Module,
  type Permission,
  type CustomPermissionsMap,
} from '@/lib/permissions'
import type { OrgRole } from '@/types/next-auth'
import { prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { getOrgContext, isRestrictedToProjects, type OrgContext } from '@/lib/org-context'
import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'

type ModuleKey = keyof typeof MODULES

async function getMemberWithPermissions(orgId: string, userId: string) {
  const member = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: { orgId, userId },
    },
    select: { role: true, customPermissions: true },
  })
  return member
}

export async function requirePermission(
  moduleKey: ModuleKey,
  permission: Permission
) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('No autorizado')
  }

  const orgId = session.user.orgId
  if (!orgId) {
    throw new Error('No tienes una organización asignada')
  }

  const member = await getMemberWithPermissions(orgId, session.user.id)
  if (!member) {
    throw new Error('Miembro no encontrado')
  }

  const module = MODULES[moduleKey] as Module
  const customPerms = (member.customPermissions as CustomPermissionsMap) ?? null
  if (!hasPermission(member.role as OrgRole, module, permission, customPerms)) {
    throw new Error(`No tienes permiso para ${permission} en este módulo`)
  }

  return session
}

export async function requireAccess(moduleKey: ModuleKey) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('No autorizado')
  }

  const orgId = session.user.orgId
  if (!orgId) {
    throw new Error('No tienes una organización asignada')
  }

  const member = await getMemberWithPermissions(orgId, session.user.id)
  if (!member) {
    throw new Error('Miembro no encontrado')
  }

  const module = MODULES[moduleKey] as Module
  const customPerms = (member.customPermissions as CustomPermissionsMap) ?? null
  if (!canAccess(member.role as OrgRole, module, customPerms)) {
    throw new Error('No tienes acceso a este módulo')
  }

  return session
}

/**
 * Shared auth context helper for server actions.
 * Validates session and org membership, redirects to login on failure.
 * Returns the session and org context for the current user.
 */
export async function getAuthContext(): Promise<{ session: NonNullable<Awaited<ReturnType<typeof getSession>>>; org: OrgContext }> {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()
  return { session, org }
}

/**
 * Use for org-level Finance actions and pages. Redirects restricted users (EDITOR/VIEWER with
 * restrictedToProjects) to /projects. OWNER, ADMIN, ACCOUNTANT are never redirected.
 */
export async function requireOrgFinanceAccess(): Promise<{ session: NonNullable<Awaited<ReturnType<typeof getSession>>>; org: OrgContext }> {
  const ctx = await getAuthContext()
  if (isRestrictedToProjects(ctx.org)) {
    await redirectTo('/projects')
  }
  return ctx
}
