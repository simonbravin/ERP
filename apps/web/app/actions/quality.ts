'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { parseUuidOrThrow } from '@/lib/schemas/ids'

async function generateRfiNumber(projectId: string): Promise<number> {
  const lastRfi = await prisma.rFI.findFirst({
    where: { projectId },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  return (lastRfi?.number ?? 0) + 1
}

export async function createRfi(
  projectId: string,
  data: {
    subject: string
    question: string
    priority: string
    wbsNodeId?: string | null
    assignedToOrgMemberId?: string | null
    dueDate?: Date | null
  }
) {
  const validProjectId = parseUuidOrThrow(projectId, 'ID de proyecto')

  const { org } = await getAuthContext()
  requireRole(org.role, 'VIEWER')

  const project = await prisma.project.findFirst({
    where: { id: validProjectId, orgId: org.orgId },
  })
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(validProjectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const number = await generateRfiNumber(validProjectId)

  const rfi = await prisma.rFI.create({
    data: {
      orgId: org.orgId,
      projectId: validProjectId,
      number,
      status: 'OPEN',
      priority: data.priority,
      wbsNodeId: data.wbsNodeId || undefined,
      raisedByOrgMemberId: org.memberId,
      assignedToOrgMemberId: data.assignedToOrgMemberId || undefined,
      subject: data.subject,
      question: data.question,
      dueDate: data.dueDate || undefined,
    },
  })

  revalidatePath(`/projects/${validProjectId}/quality`)
  revalidatePath(`/projects/${validProjectId}/quality/rfis`)
  return { success: true, rfiId: rfi.id }
}

export async function addRfiComment(rfiId: string, comment: string) {
  const validRfiId = parseUuidOrThrow(rfiId, 'ID de RFI')

  const { org } = await getAuthContext()

  const rfi = await prisma.rFI.findFirst({
    where: { id: validRfiId, orgId: org.orgId },
    select: { projectId: true },
  })
  if (!rfi) throw new Error('RFI not found')
  try {
    const access = await assertProjectAccess(rfi.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.rFIComment.create({
    data: {
      orgId: org.orgId,
      rfiId: validRfiId,
      orgMemberId: org.memberId,
      comment,
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${validRfiId}`)
  return { success: true }
}

export async function answerRfi(rfiId: string, answer: string) {
  const validRfiId = parseUuidOrThrow(rfiId, 'ID de RFI')

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const rfi = await prisma.rFI.findFirst({
    where: { id: validRfiId, orgId: org.orgId },
    select: { projectId: true },
  })
  if (!rfi) throw new Error('RFI not found')
  try {
    const access = await assertProjectAccess(rfi.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.rFI.update({
    where: { id: validRfiId },
    data: {
      answer,
      status: 'ANSWERED',
      answeredDate: new Date(),
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${validRfiId}`)
  revalidatePath(`/projects/${rfi.projectId}/quality`)
  return { success: true }
}

export async function closeRfi(rfiId: string) {
  const validRfiId = parseUuidOrThrow(rfiId, 'ID de RFI')

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const rfi = await prisma.rFI.findFirst({
    where: { id: validRfiId, orgId: org.orgId },
    select: { projectId: true },
  })
  if (!rfi) throw new Error('RFI not found')
  try {
    const access = await assertProjectAccess(rfi.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.rFI.update({
    where: { id: validRfiId },
    data: {
      status: 'CLOSED',
      closedDate: new Date(),
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${validRfiId}`)
  revalidatePath(`/projects/${rfi.projectId}/quality`)
  return { success: true }
}

export async function createSubmittal(
  projectId: string,
  data: {
    submittalType: string
    specSection?: string | null
    wbsNodeId?: string | null
    submittedByPartyId?: string | null
    dueDate: Date
  }
) {
  const validProjectId = parseUuidOrThrow(projectId, 'ID de proyecto')

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await prisma.project.findFirst({
    where: { id: validProjectId, orgId: org.orgId },
  })
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(validProjectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const lastSubmittal = await prisma.submittal.findFirst({
    where: { projectId: validProjectId },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const number = (lastSubmittal?.number ?? 0) + 1

  const submittal = await prisma.submittal.create({
    data: {
      orgId: org.orgId,
      projectId: validProjectId,
      number,
      submittalType: data.submittalType,
      status: 'DRAFT',
      specSection: data.specSection || undefined,
      wbsNodeId: data.wbsNodeId || undefined,
      submittedByPartyId: data.submittedByPartyId || undefined,
      dueDate: data.dueDate,
      revisionNumber: 0,
    },
  })

  revalidatePath(`/projects/${validProjectId}/quality`)
  revalidatePath(`/projects/${validProjectId}/quality/submittals`)
  return { success: true, submittalId: submittal.id }
}

export async function submitSubmittal(submittalId: string) {
  const validSubmittalId = parseUuidOrThrow(submittalId, 'ID de submittal')

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const submittal = await prisma.submittal.findFirst({
    where: { id: validSubmittalId, orgId: org.orgId },
    select: { projectId: true },
  })
  if (!submittal) throw new Error('Submittal not found')
  try {
    const access = await assertProjectAccess(submittal.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.submittal.update({
    where: { id: validSubmittalId },
    data: {
      status: 'SUBMITTED',
      submittedDate: new Date(),
    },
  })

  revalidatePath(`/projects/${submittal.projectId}/quality/submittals/${validSubmittalId}`)
  revalidatePath(`/projects/${submittal.projectId}/quality`)
  return { success: true }
}

export async function reviewSubmittal(
  submittalId: string,
  data: {
    status: string
    reviewComments?: string | null
  }
) {
  const validSubmittalId = parseUuidOrThrow(submittalId, 'ID de submittal')

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const submittal = await prisma.submittal.findFirst({
    where: { id: validSubmittalId, orgId: org.orgId },
    select: { projectId: true, revisionNumber: true },
  })
  if (!submittal) throw new Error('Submittal not found')
  try {
    const access = await assertProjectAccess(submittal.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const newRevision = ['REJECTED', 'REVISE_AND_RESUBMIT'].includes(data.status)
    ? submittal.revisionNumber + 1
    : submittal.revisionNumber

  await prisma.submittal.update({
    where: { id: validSubmittalId },
    data: {
      status: data.status,
      reviewComments: data.reviewComments || undefined,
      reviewedByOrgMemberId: org.memberId,
      reviewedDate: new Date(),
      revisionNumber: newRevision,
    },
  })

  revalidatePath(`/projects/${submittal.projectId}/quality/submittals/${validSubmittalId}`)
  revalidatePath(`/projects/${submittal.projectId}/quality`)
  return { success: true }
}
