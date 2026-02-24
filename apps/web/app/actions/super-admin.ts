'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@repo/database'
import type { Prisma } from '@repo/database'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Unauthorized: Super Admin access required')
  }
  return session.user
}

async function createSuperAdminLog(
  superAdminId: string,
  superAdminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>,
  ipAddress?: string | null
) {
  await prisma.superAdminLog.create({
    data: {
      superAdminId,
      superAdminEmail,
      action,
      targetType,
      targetId,
      details: details ?? undefined,
      ipAddress: ipAddress ?? undefined,
    },
  })
}

async function getClientIp(): Promise<string | undefined> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    const real = h.get('x-real-ip')
    return forwarded?.split(',')[0]?.trim() ?? real ?? undefined
  } catch {
    return undefined
  }
}

export async function getSuperAdminDashboardStats() {
  await requireSuperAdmin()
  const [orgsTotal, orgsActive, orgsBlocked, usersTotal, recentOrgs] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { active: true, isBlocked: false } }),
    prisma.organization.count({ where: { isBlocked: true } }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
    prisma.organization.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        subscriptionStatus: true,
        isBlocked: true,
        createdAt: true,
        _count: { select: { members: true, projects: true } },
      },
    }),
  ])
  return {
    orgsTotal,
    orgsActive,
    orgsBlocked,
    usersTotal,
    recentOrgs,
  }
}

export async function getAllOrganizations() {
  await requireSuperAdmin()
  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: { members: true, projects: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return orgs
}

export async function getOrganizationDetails(orgId: string) {
  await requireSuperAdmin()
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
      projects: {
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true,
        },
      },
      usageMetrics: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      },
    },
  })
  return org
}

export async function toggleOrganizationBlock(
  orgId: string,
  block: boolean,
  reason?: string
) {
  const superAdmin = await requireSuperAdmin()
  const ip = await getClientIp()
  try {
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        isBlocked: block,
        blockedReason: block ? reason ?? null : null,
        blockedAt: block ? new Date() : null,
        blockedBy: block ? superAdmin.id : null,
      },
    })
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      block ? 'BLOCK_ORG' : 'UNBLOCK_ORG',
      'ORGANIZATION',
      orgId,
      { reason },
      ip
    )
    revalidatePath('/super-admin')
    revalidatePath('/super-admin/organizations')
    return { success: true, org }
  } catch (error) {
    console.error('Error toggling org block:', error)
    return { success: false, error: 'Error al bloquear/desbloquear organización' }
  }
}

export async function updateOrganizationPlan(
  orgId: string,
  plan: string,
  maxProjects: number,
  maxUsers: number,
  maxStorageGB: number
) {
  const superAdmin = await requireSuperAdmin()
  const ip = await getClientIp()
  try {
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        subscriptionPlan: plan,
        maxProjects,
        maxUsers,
        maxStorageGB,
      },
    })
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      'CHANGE_PLAN',
      'ORGANIZATION',
      orgId,
      { plan, maxProjects, maxUsers, maxStorageGB },
      ip
    )
    revalidatePath('/super-admin')
    revalidatePath('/super-admin/organizations')
    return { success: true, org }
  } catch (error) {
    console.error('Error updating plan:', error)
    return { success: false, error: 'Error al actualizar plan' }
  }
}

export async function updateOrganizationModules(
  orgId: string,
  enabledModules: string[]
) {
  const superAdmin = await requireSuperAdmin()
  const ip = await getClientIp()
  try {
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { enabledModules: enabledModules as Prisma.InputJsonValue },
    })
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      'UPDATE_MODULES',
      'ORGANIZATION',
      orgId,
      { enabledModules },
      ip
    )
    revalidatePath('/super-admin')
    revalidatePath('/super-admin/organizations')
    return { success: true, org }
  } catch (error) {
    console.error('Error updating modules:', error)
    return { success: false, error: 'Error al actualizar módulos' }
  }
}

export async function getAllUsers() {
  await requireSuperAdmin()
  const users = await prisma.user.findMany({
    where: { isSuperAdmin: false },
    include: {
      memberships: {
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return users
}

export async function getSuperAdminLogs(limit: number = 100) {
  await requireSuperAdmin()
  const logs = await prisma.superAdminLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return logs
}

export async function impersonateOrganization(orgId: string) {
  const superAdmin = await requireSuperAdmin()
  const ip = await getClientIp()
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          where: { role: 'OWNER' },
          take: 1,
        },
      },
    })
    if (!org || org.members.length === 0) {
      return { success: false, error: 'Organization not found or no owner' }
    }
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      'IMPERSONATE',
      'ORGANIZATION',
      orgId,
      { orgName: org.name },
      ip
    )
    return {
      success: true,
      org: { id: org.id, name: org.name },
      owner: org.members[0],
    }
  } catch (error) {
    console.error('Error impersonating:', error)
    return { success: false, error: 'Error al impersonar' }
  }
}

/** Obtener detalles de un usuario específico (desde super admin) */
export async function getUserDetails(userId: string) {
  await requireSuperAdmin()
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              include: { profile: { select: { legalName: true } } },
            },
          },
        },
      },
    })
    if (!user) {
      return { success: false, error: 'User not found', user: null }
    }
    const orgMembers = user.memberships.map((m) => ({
      id: m.id,
      role: m.role,
      isActive: m.active,
      customPermissions: m.customPermissions as Record<string, string[]> | null,
      organization: {
        id: m.organization.id,
        name: m.organization.name,
        legalName: (m.organization as { profile?: { legalName: string | null } }).profile?.legalName ?? null,
        isBlocked: m.organization.isBlocked,
      },
    }))
    return {
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        orgMembers,
      },
    }
  } catch (error) {
    console.error('Error getting user details:', error)
    return { success: false, error: 'Error al obtener detalles del usuario', user: null }
  }
}

/** Actualizar permisos de módulos para un usuario en una org */
export async function updateUserModules(
  userId: string,
  orgId: string,
  enabledModules: string[]
) {
  const superAdmin = await requireSuperAdmin()
  try {
    const orgMember = await prisma.orgMember.findFirst({
      where: { userId, orgId },
      include: {
        user: { select: { fullName: true, email: true } },
        organization: { select: { name: true } },
      },
    })
    if (!orgMember) {
      return { success: false, error: 'User membership not found' }
    }
    const customPermissions: Record<string, string[]> = {}
    enabledModules.forEach((module) => {
      customPermissions[module] = ['view', 'create', 'edit']
    })
    await prisma.orgMember.update({
      where: { id: orgMember.id },
      data: { customPermissions: customPermissions as Prisma.InputJsonValue },
    })
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      'UPDATE_USER_MODULES',
      'USER',
      userId,
      {
        orgId,
        orgName: orgMember.organization.name,
        userName: orgMember.user.fullName,
        enabledModules,
      }
    )
    revalidatePath('/super-admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error updating user modules:', error)
    return { success: false, error: 'Error al actualizar módulos del usuario' }
  }
}

/** Activar/desactivar usuario en una org */
export async function toggleUserStatus(
  userId: string,
  orgId: string,
  isActive: boolean
) {
  const superAdmin = await requireSuperAdmin()
  try {
    const orgMember = await prisma.orgMember.findFirst({
      where: { userId, orgId },
      include: {
        user: { select: { fullName: true, email: true } },
        organization: { select: { name: true } },
      },
    })
    if (!orgMember) {
      return { success: false, error: 'User membership not found' }
    }
    await prisma.orgMember.update({
      where: { id: orgMember.id },
      data: { active: isActive },
    })
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      'USER',
      userId,
      {
        orgId,
        orgName: orgMember.organization.name,
        userName: orgMember.user.fullName,
      }
    )
    revalidatePath('/super-admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error toggling user status:', error)
    return { success: false, error: 'Error al cambiar estado del usuario' }
  }
}

/** Cambiar rol de un miembro en una organización (solo super-admin). No permite cambiar OWNER. */
export async function setOrgMemberRole(
  userId: string,
  orgId: string,
  newRole: 'ADMIN' | 'EDITOR' | 'ACCOUNTANT' | 'VIEWER'
): Promise<{ success: true } | { success: false; error: string }> {
  const superAdmin = await requireSuperAdmin()
  try {
    const orgMember = await prisma.orgMember.findFirst({
      where: { userId, orgId },
      include: {
        user: { select: { fullName: true, email: true } },
        organization: { select: { name: true } },
      },
    })
    if (!orgMember) {
      return { success: false, error: 'Miembro no encontrado en esta organización' }
    }
    if (userId === superAdmin.id) {
      return { success: false, error: 'No puedes cambiar tu propio rol' }
    }
    if (orgMember.role === 'OWNER') {
      return { success: false, error: 'No se puede cambiar el rol del dueño de la organización' }
    }
    await prisma.orgMember.update({
      where: { id: orgMember.id },
      data: { role: newRole },
    })
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      'SET_ORG_MEMBER_ROLE',
      'USER',
      userId,
      {
        orgId,
        orgName: orgMember.organization.name,
        userName: orgMember.user.fullName,
        previousRole: orgMember.role,
        newRole,
      }
    )
    revalidatePath('/super-admin/users')
    revalidatePath('/team')
    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error setting org member role:', error)
    return { success: false, error: 'Error al cambiar el rol' }
  }
}

/** Resetear contraseña de usuario */
export async function resetUserPassword(userId: string, newPassword: string) {
  const superAdmin = await requireSuperAdmin()
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    })
    if (!user) {
      return { success: false, error: 'User not found' }
    }
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    })
    await createSuperAdminLog(
      superAdmin.id,
      superAdmin.email ?? '',
      'RESET_PASSWORD',
      'USER',
      userId,
      { userName: user.fullName, userEmail: user.email }
    )
    revalidatePath('/super-admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error resetting password:', error)
    return { success: false, error: 'Error al resetear contraseña' }
  }
}
