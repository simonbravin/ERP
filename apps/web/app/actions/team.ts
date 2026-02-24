'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { prisma } from '@repo/database'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import type { OrgRole } from '@prisma/client'
import type { InviteTeamMemberInput } from '@repo/validators'
import { sendInvitationEmail } from '@/lib/email'
import { requirePermission } from '@/lib/auth-helpers'
import { publishOutboxEvent } from '@/lib/events/event-publisher'

export async function inviteTeamMember(data: InviteTeamMemberInput) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'Unauthorized' }

  try {
    requireRole(orgContext.role, 'OWNER')
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  const orgId = orgContext.orgId

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    })

    if (existingUser) {
      const existingMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: { orgId, userId: existingUser.id },
        },
      })

      if (existingMember) {
        return { success: false, error: 'Este usuario ya es miembro de la organización' }
      }

      await prisma.$transaction(async (tx) => {
        const member = await tx.orgMember.create({
          data: {
            orgId,
            userId: existingUser.id,
            role: data.role,
            active: true,
            customPermissions: null,
          },
        })
        await publishOutboxEvent(tx, {
          orgId,
          eventType: 'ORG_MEMBER.INVITED',
          entityType: 'OrgMember',
          entityId: member.id,
          payload: { userId: existingUser.id, role: data.role },
        })
      })

      // TODO: Enviar email de notificación

      revalidatePath('/settings/team')
      return { success: true }
    }

    // Usuario no existe - requiere registro previo (sin modelo OrgInvitation)
    return {
      success: false,
      error: 'Usuario no encontrado. Debe registrarse primero en la plataforma.',
    }
  } catch (error) {
    console.error('Error inviting member:', error)
    return { success: false, error: 'Error al enviar la invitación' }
  }
}

export async function deactivateMember(memberId: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'Unauthorized' }

  try {
    requireRole(orgContext.role, 'OWNER')
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const member = await prisma.orgMember.findFirst({
      where: { id: memberId, orgId: orgContext.orgId },
    })

    if (!member) {
      return { success: false, error: 'Miembro no encontrado' }
    }

    if (member.role === 'OWNER') {
      return { success: false, error: 'No se puede desactivar al propietario' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.orgMember.update({
        where: { id: memberId },
        data: { active: false },
      })
      await publishOutboxEvent(tx, {
        orgId: orgContext.orgId,
        eventType: 'ORG_MEMBER.UPDATED',
        entityType: 'OrgMember',
        entityId: memberId,
        payload: { active: false },
      })
    })

    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error deactivating member:', error)
    return { success: false, error: 'Error al desactivar el miembro' }
  }
}

export async function activateMember(memberId: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'Unauthorized' }

  try {
    requireRole(orgContext.role, 'OWNER')
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const member = await prisma.orgMember.findFirst({
      where: { id: memberId, orgId: orgContext.orgId },
    })

    if (!member) {
      return { success: false, error: 'Miembro no encontrado' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.orgMember.update({
        where: { id: memberId },
        data: { active: true },
      })
      await publishOutboxEvent(tx, {
        orgId: orgContext.orgId,
        eventType: 'ORG_MEMBER.UPDATED',
        entityType: 'OrgMember',
        entityId: memberId,
        payload: { active: true },
      })
    })

    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error activating member:', error)
    return { success: false, error: 'Error al activar el miembro' }
  }
}

export async function resendInvitation(memberId: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'Unauthorized' }

  try {
    requireRole(orgContext.role, 'OWNER')
  } catch {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // TODO: Recuperar email del miembro pendiente (requiere modelo OrgInvitation)
    // TODO: Reenviar email con link de registro

    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error resending invitation:', error)
    return { success: false, error: 'Error al reenviar la invitación' }
  }
}

/** Re-sends the invitation email for a pending invitation (by invitation id). Use from the pending invitations list. */
export async function resendInvitationEmail(invitationId: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'Unauthorized' }

  try {
    requireRole(orgContext.role as 'OWNER' | 'ADMIN', 'ADMIN')
  } catch {
    return { success: false, error: 'No tienes permiso para reenviar invitaciones' }
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      orgId: orgContext.orgId,
      status: 'PENDING',
      expiresAt: { gte: new Date() },
    },
    include: {
      invitedBy: { select: { fullName: true, name: true, email: true } },
    },
  })

  if (!invitation) {
    return { success: false, error: 'Invitación no encontrada o expirada' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'es'
  const invitationUrl = `${baseUrl}/${defaultLocale}/invite/${invitation.token}`

  const org = await prisma.organization.findUnique({
    where: { id: orgContext.orgId },
    select: { name: true },
  })

  const inviterName =
    invitation.invitedBy?.fullName ??
    invitation.invitedBy?.name ??
    invitation.invitedBy?.email ??
    'Un administrador'

  const emailResult = await sendInvitationEmail({
    to: invitation.email,
    inviterName,
    orgName: org?.name ?? 'la organización',
    invitationUrl,
    role: invitation.role,
  })

  if (!emailResult.success) {
    console.error('Resend invitation email error:', emailResult.error)
    return {
      success: false,
      error:
        (emailResult.error as { message?: string })?.message ??
        'No se pudo enviar el correo',
    }
  }

  revalidatePath('/team')
  revalidatePath('/settings/team')
  return { success: true }
}

// ==================== ORG MEMBERS (for /team page) ====================

export async function getOrgMembers() {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  return prisma.orgMember.findMany({
    where: { orgId: orgContext.orgId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

// ==================== PERMISOS PERSONALIZADOS ====================

export async function getMemberPermissions(memberId: string) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, orgId: orgContext.orgId },
    select: {
      id: true,
      role: true,
      customPermissions: true,
      restrictedToProjects: true,
      user: {
        select: { fullName: true, email: true },
      },
    },
  })

  if (!member) throw new Error('Miembro no encontrado')
  return member
}

/** Project assignments for a given org member (for team permissions UI). Only OWNER/ADMIN. */
export async function getProjectAssignmentsForMember(orgMemberId: string) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  try {
    requireRole(orgContext.role as 'OWNER' | 'ADMIN', 'ADMIN')
  } catch {
    throw new Error('No tienes permiso para ver asignaciones')
  }

  const member = await prisma.orgMember.findFirst({
    where: { id: orgMemberId, orgId: orgContext.orgId },
  })
  if (!member) throw new Error('Miembro no encontrado')

  const assignments = await prisma.projectMember.findMany({
    where: { orgMemberId },
    include: {
      project: {
        select: { id: true, name: true, projectNumber: true },
      },
    },
    orderBy: { project: { name: 'asc' } },
  })

  return assignments.map((a) => ({
    id: a.id,
    projectId: a.projectId,
    projectName: a.project.name,
    projectNumber: a.project.projectNumber,
    projectRole: a.projectRole,
  }))
}

/** Set restrictedToProjects for a member. Only OWNER/ADMIN; target must be EDITOR or VIEWER. */
export async function setMemberRestrictedToProjects(
  orgMemberId: string,
  restricted: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'No autorizado' }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'No autorizado' }

  try {
    requireRole(orgContext.role as 'OWNER' | 'ADMIN', 'ADMIN')
  } catch {
    return { success: false, error: 'No tienes permiso para esta acción' }
  }

  const target = await prisma.orgMember.findFirst({
    where: { id: orgMemberId, orgId: orgContext.orgId },
  })
  if (!target) return { success: false, error: 'Miembro no encontrado' }

  const restrictedRoles = ['EDITOR', 'VIEWER']
  if (!restrictedRoles.includes(target.role)) {
    return {
      success: false,
      error: 'Solo se puede restringir a usuarios con rol EDITOR o VIEWER',
    }
  }

  await prisma.orgMember.update({
    where: { id: orgMemberId },
    data: { restrictedToProjects: restricted },
  })

  revalidatePath('/team')
  revalidatePath(`/team/${orgMemberId}/permissions`)
  revalidatePath('/settings/team')
  return { success: true }
}

export async function updateMemberPermissions(
  memberId: string,
  customPermissions: Record<string, string[]> | null
) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'No autorizado' }

  try {
    requireRole(orgContext.role as 'OWNER' | 'ADMIN', 'ADMIN')
  } catch {
    return { success: false, error: 'No tienes permiso para cambiar permisos' }
  }

  const target = await prisma.orgMember.findFirst({
    where: { id: memberId, orgId: orgContext.orgId },
  })
  if (!target) return { success: false, error: 'Miembro no encontrado' }
  if (target.userId === session.user.id) {
    return { success: false, error: 'No puedes modificar tus propios permisos' }
  }
  if (target.role === 'OWNER') {
    return { success: false, error: 'No se pueden modificar permisos del dueño' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.orgMember.update({
      where: { id: memberId },
      data: { customPermissions: customPermissions as object },
    })
    await publishOutboxEvent(tx, {
      orgId: orgContext.orgId,
      eventType: 'ORG_MEMBER.UPDATED',
      entityType: 'OrgMember',
      entityId: memberId,
      payload: { customPermissions: true },
    })
  })

  revalidatePath('/team')
  revalidatePath(`/team/${memberId}/permissions`)
  return { success: true }
}

export async function resetMemberPermissions(memberId: string) {
  return updateMemberPermissions(memberId, null)
}

// ==================== INVITATIONS (email + token) ====================

export async function inviteUser(data: { email: string; role: OrgRole }) {
  await requirePermission('TEAM', 'create')
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  const orgId = orgContext.orgId
  const email = data.email.toLowerCase().trim()

  const existingMember = await prisma.orgMember.findFirst({
    where: {
      orgId,
      user: { email },
    },
  })

  if (existingMember) {
    throw new Error('Este usuario ya es miembro de la organización')
  }

  const existingInvitation = await prisma.invitation.findUnique({
    where: {
      orgId_email: { orgId, email },
    },
  })

  const now = new Date()
  if (
    existingInvitation?.status === 'PENDING' &&
    existingInvitation.expiresAt >= now
  ) {
    throw new Error('Ya existe una invitación pendiente para este email')
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Upsert: crea nueva invitación o reutiliza la fila (org_id, email) si ya existía (EXPIRED/REVOKED/ACCEPTED)
  const invitation = await prisma.invitation.upsert({
    where: {
      orgId_email: { orgId, email },
    },
    create: {
      orgId,
      email,
      role: data.role,
      token,
      expiresAt,
      invitedByUserId: session.user.id,
    },
    update: {
      token,
      expiresAt,
      role: data.role,
      status: 'PENDING',
      invitedByUserId: session.user.id,
    },
  })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'es'
  const invitationUrl = `${baseUrl}/${defaultLocale}/invite/${token}`
  const emailResult = await sendInvitationEmail({
    to: email,
    inviterName: session.user.name ?? session.user.email ?? 'Un administrador',
    orgName: org?.name ?? 'la organización',
    invitationUrl,
    role: data.role,
  })

  if (!emailResult.success) {
    console.error('Failed to send invitation email:', emailResult.error)
    // Still save invitation; admin can resend later
  }

  revalidatePath('/team')
  revalidatePath('/settings/team')
  return { success: true, invitationId: invitation.id }
}

export async function getPendingInvitations() {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  return prisma.invitation.findMany({
    where: {
      orgId: orgContext.orgId,
      status: 'PENDING',
      expiresAt: { gte: new Date() },
    },
    include: {
      invitedBy: {
        select: { fullName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function revokeInvitation(invitationId: string) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, orgId: orgContext.orgId },
  })

  if (!invitation) throw new Error('Invitación no encontrada')

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'REVOKED' },
  })

  revalidatePath('/team')
  revalidatePath('/settings/team')
  return { success: true }
}

export async function acceptInvitation(
  token: string,
  userData: { fullName: string; password: string }
) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  })

  if (!invitation) throw new Error('Invitación no encontrada')
  if (invitation.status !== 'PENDING') {
    throw new Error('Esta invitación ya fue procesada')
  }
  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('Esta invitación ha expirado')
  }

  let user = await prisma.user.findUnique({
    where: { email: invitation.email },
  })

  if (!user) {
    const hashedPassword = await bcrypt.hash(userData.password, 10)
    user = await prisma.user.create({
      data: {
        email: invitation.email,
        fullName: userData.fullName,
        passwordHash: hashedPassword,
      },
    })
  }

  const existingMember = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: { orgId: invitation.orgId, userId: user.id },
    },
  })

  if (!existingMember) {
    await prisma.orgMember.create({
      data: {
        orgId: invitation.orgId,
        userId: user.id,
        role: invitation.role,
        active: true,
        customPermissions: null,
      },
    })
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED' },
  })

  return {
    success: true,
    userId: user.id,
    orgId: invitation.orgId,
  }
}

// ==================== UPDATE ROLE / TOGGLE STATUS (used by team page) ====================

export async function updateMemberRole(
  memberId: string,
  newRole: OrgRole
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'No autorizado' }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'No autorizado' }

  try {
    requireRole(orgContext.role as 'OWNER' | 'ADMIN', 'ADMIN')
  } catch {
    return { success: false, error: 'No tienes permiso para cambiar roles' }
  }

  const targetMember = await prisma.orgMember.findFirst({
    where: { id: memberId, orgId: orgContext.orgId },
  })

  if (!targetMember) return { success: false, error: 'Miembro no encontrado' }
  if (targetMember.userId === session.user.id) {
    return { success: false, error: 'No puedes cambiar tu propio rol' }
  }
  if (targetMember.role === 'OWNER') {
    return { success: false, error: 'No se puede cambiar el rol del dueño' }
  }

  await prisma.orgMember.update({
    where: { id: memberId },
    data: { role: newRole },
  })

  revalidatePath('/team')
  revalidatePath('/settings/team')
  return { success: true }
}

export async function toggleMemberStatus(
  memberId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    try {
      await requirePermission('TEAM', 'edit')
    } catch {
      return { success: false, error: 'No tienes permiso para esta acción' }
    }
    const session = await getSession()
    if (!session?.user?.id) return { success: false, error: 'No autorizado' }

    const orgContext = await getOrgContext(session.user.id)
    if (!orgContext) return { success: false, error: 'No autorizado' }

    const member = await prisma.orgMember.findFirst({
      where: { id: memberId, orgId: orgContext.orgId },
    })

    if (!member) return { success: false, error: 'Miembro no encontrado' }
    if (member.role === 'OWNER') {
      return { success: false, error: 'No se puede desactivar al dueño' }
    }

    await prisma.orgMember.update({
      where: { id: memberId },
      data: { active: !member.active },
    })

    revalidatePath('/team')
    revalidatePath('/settings/team')
    return { success: true }
  } catch (error) {
    console.error('Error toggling member status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al cambiar estado',
    }
  }
}

// ==================== PROJECT MEMBERS ====================

export async function getProjectMembers(projectId: string) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: orgContext.orgId },
  })
  if (!project) throw new Error('Proyecto no encontrado')

  return prisma.projectMember.findMany({
    where: { projectId },
    include: {
      orgMember: {
        include: {
          user: {
            select: { fullName: true, email: true },
          },
        },
      },
    },
  })
}

export async function addProjectMember(data: {
  projectId: string
  orgMemberId: string
  role: string
}) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  const project = await prisma.project.findFirst({
    where: { id: data.projectId, orgId: orgContext.orgId },
  })
  if (!project) throw new Error('Proyecto no encontrado')

  try {
    const access = await assertProjectAccess(data.projectId, orgContext)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.TEAM)) {
      throw new Error('No tenés permiso para gestionar el equipo de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const orgMember = await prisma.orgMember.findFirst({
    where: { id: data.orgMemberId, orgId: orgContext.orgId },
  })
  if (!orgMember) throw new Error('Miembro no encontrado')

  await prisma.projectMember.create({
    data: {
      projectId: data.projectId,
      orgMemberId: data.orgMemberId,
      projectRole: data.role,
    },
  })

  revalidatePath(`/projects/${data.projectId}/team`)
  revalidatePath('/team')
  revalidatePath(`/team/${data.orgMemberId}/permissions`)
  return { success: true }
}

export async function removeProjectMember(projectMemberId: string) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('No autorizado')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('No autorizado')

  const pm = await prisma.projectMember.findFirst({
    where: { id: projectMemberId },
    include: { project: true },
  })
  if (!pm || pm.project.orgId !== orgContext.orgId) {
    throw new Error('No encontrado')
  }

  try {
    const access = await assertProjectAccess(pm.projectId, orgContext)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.TEAM)) {
      throw new Error('No tenés permiso para gestionar el equipo de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const orgMemberId = pm.orgMemberId
  await prisma.projectMember.delete({
    where: { id: projectMemberId },
  })

  revalidatePath(`/projects/${pm.projectId}/team`)
  revalidatePath('/team')
  revalidatePath(`/team/${orgMemberId}/permissions`)
  return { success: true }
}
