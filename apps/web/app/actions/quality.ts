'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { parseUuid } from '@/lib/schemas/ids'

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
  const parsedProject = parseUuid(projectId, 'ID de proyecto')
  if (!parsedProject.success) throw new Error(parsedProject.error)

  const { org } = await getAuthContext()
  requireRole(org.role, 'VIEWER')

  const project = await prisma.project.findFirst({
    where: { id: parsedProject.value, orgId: org.orgId },
  })
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(parsedProject.value, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const number = await generateRfiNumber(parsedProject.value)

  const rfi = await prisma.rFI.create({
    data: {
      orgId: org.orgId,
      projectId: parsedProject.value,
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

  revalidatePath(`/projects/${parsedProject.value}/quality`)
  revalidatePath(`/projects/${parsedProject.value}/quality/rfis`)
  return { success: true, rfiId: rfi.id }
}

export async function addRfiComment(rfiId: string, comment: string) {
  const parsedRfi = parseUuid(rfiId, 'ID de RFI')
  if (!parsedRfi.success) throw new Error(parsedRfi.error)

  const { org } = await getAuthContext()

  const rfi = await prisma.rFI.findFirst({
    where: { id: parsedRfi.value, orgId: org.orgId },
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
      rfiId: parsedRfi.value,
      orgMemberId: org.memberId,
      comment,
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${parsedRfi.value}`)
  return { success: true }
}

export async function answerRfi(rfiId: string, answer: string) {
  const parsedRfi = parseUuid(rfiId, 'ID de RFI')
  if (!parsedRfi.success) throw new Error(parsedRfi.error)

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const rfi = await prisma.rFI.findFirst({
    where: { id: parsedRfi.value, orgId: org.orgId },
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
    where: { id: parsedRfi.value },
    data: {
      answer,
      status: 'ANSWERED',
      answeredDate: new Date(),
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${parsedRfi.value}`)
  revalidatePath(`/projects/${rfi.projectId}/quality`)
  return { success: true }
}

export async function closeRfi(rfiId: string) {
  const parsedRfi = parseUuid(rfiId, 'ID de RFI')
  if (!parsedRfi.success) throw new Error(parsedRfi.error)

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const rfi = await prisma.rFI.findFirst({
    where: { id: parsedRfi.value, orgId: org.orgId },
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
    where: { id: parsedRfi.value },
    data: {
      status: 'CLOSED',
      closedDate: new Date(),
    },
  })

  revalidatePath(`/projects/${rfi.projectId}/quality/rfis/${parsedRfi.value}`)
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
  const parsedProject = parseUuid(projectId, 'ID de proyecto')
  if (!parsedProject.success) throw new Error(parsedProject.error)

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await prisma.project.findFirst({
    where: { id: parsedProject.value, orgId: org.orgId },
  })
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(parsedProject.value, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.QUALITY)) {
      throw new Error('No tenés permiso para editar calidad de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const lastSubmittal = await prisma.submittal.findFirst({
    where: { projectId: parsedProject.value },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const number = (lastSubmittal?.number ?? 0) + 1

  const submittal = await prisma.submittal.create({
    data: {
      orgId: org.orgId,
      projectId: parsedProject.value,
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

  revalidatePath(`/projects/${parsedProject.value}/quality`)
  revalidatePath(`/projects/${parsedProject.value}/quality/submittals`)
  return { success: true, submittalId: submittal.id }
}

export async function submitSubmittal(submittalId: string) {
  const parsedSubmittal = parseUuid(submittalId, 'ID de submittal')
  if (!parsedSubmittal.success) throw new Error(parsedSubmittal.error)

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const submittal = await prisma.submittal.findFirst({
    where: { id: parsedSubmittal.value, orgId: org.orgId },
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
    where: { id: parsedSubmittal.value },
    data: {
      status: 'SUBMITTED',
      submittedDate: new Date(),
    },
  })

  revalidatePath(`/projects/${submittal.projectId}/quality/submittals/${parsedSubmittal.value}`)
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
  const parsedSubmittal = parseUuid(submittalId, 'ID de submittal')
  if (!parsedSubmittal.success) throw new Error(parsedSubmittal.error)

  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const submittal = await prisma.submittal.findFirst({
    where: { id: parsedSubmittal.value, orgId: org.orgId },
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
    where: { id: parsedSubmittal.value },
    data: {
      status: data.status,
      reviewComments: data.reviewComments || undefined,
      reviewedByOrgMemberId: org.memberId,
      reviewedDate: new Date(),
      revisionNumber: newRevision,
    },
  })

  revalidatePath(`/projects/${submittal.projectId}/quality/submittals/${parsedSubmittal.value}`)
  revalidatePath(`/projects/${submittal.projectId}/quality`)
  return { success: true }
}
