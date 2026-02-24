'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'

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
  const { org } = await getAuthContext()
  requireRole(org.role, 'VIEWER')

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
  })
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const number = await generateRfiNumber(projectId)

  const rfi = await prisma.rFI.create({
    data: {
      orgId: org.orgId,
      projectId,
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

  revalidatePath(`/projects/${projectId}/quality`)
  revalidatePath(`/projects/${projectId}/quality/rfis`)
  return { success: true, rfiId: rfi.id }
}

export async function addRfiComment(rfiId: string, comment: string) {
  const { org } = await getAuthContext()

  const rfi = await prisma.rFI.findFirst({
    where: { id: rfiId, orgId: org.orgId },
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
      rfiId,
      orgMemberId: org.memberId,
      comment,
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${rfiId}`)
  return { success: true }
}

export async function answerRfi(rfiId: string, answer: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const rfi = await prisma.rFI.findFirst({
    where: { id: rfiId, orgId: org.orgId },
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
    where: { id: rfiId },
    data: {
      answer,
      status: 'ANSWERED',
      answeredDate: new Date(),
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${rfiId}`)
  revalidatePath(`/projects/${rfi.projectId}/quality`)
  return { success: true }
}

export async function closeRfi(rfiId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const rfi = await prisma.rFI.findFirst({
    where: { id: rfiId, orgId: org.orgId },
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
    where: { id: rfiId },
    data: {
      status: 'CLOSED',
      closedDate: new Date(),
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${rfiId}`)
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
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
  })
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const lastSubmittal = await prisma.submittal.findFirst({
    where: { projectId },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const number = (lastSubmittal?.number ?? 0) + 1

  const submittal = await prisma.submittal.create({
    data: {
      orgId: org.orgId,
      projectId,
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

  revalidatePath(`/projects/${projectId}/quality`)
  revalidatePath(`/projects/${projectId}/quality/submittals`)
  return { success: true, submittalId: submittal.id }
}

export async function submitSubmittal(submittalId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const submittal = await prisma.submittal.findFirst({
    where: { id: submittalId, orgId: org.orgId },
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
    where: { id: submittalId },
    data: {
      status: 'SUBMITTED',
      submittedDate: new Date(),
    },
  })

  revalidatePath(`/projects/${submittal.projectId}/quality/submittals/${submittalId}`)
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
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const submittal = await prisma.submittal.findFirst({
    where: { id: submittalId, orgId: org.orgId },
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
    where: { id: submittalId },
    data: {
      status: data.status,
      reviewComments: data.reviewComments || undefined,
      reviewedByOrgMemberId: org.memberId,
      reviewedDate: new Date(),
      revisionNumber: newRevision,
    },
  })

  revalidatePath(`/projects/${submittal.projectId}/quality/submittals/${submittalId}`)
  revalidatePath(`/projects/${submittal.projectId}/quality`)
  return { success: true }
}
