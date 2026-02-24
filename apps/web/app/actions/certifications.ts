'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { requirePermission, getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import crypto from 'crypto'
import { publishOutboxEvent } from '@/lib/events/event-publisher'

async function generateCertNumber(projectId: string): Promise<number> {
  const lastCert = await prisma.certification.findFirst({
    where: { projectId },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  return (lastCert?.number ?? 0) + 1
}

async function calculatePrevProgress(
  budgetLineId: string,
  currentPeriod: { month: number; year: number }
) {
  const prevCerts = await prisma.certificationLine.findMany({
    where: {
      budgetLineId,
      certification: {
        status: 'APPROVED',
        OR: [
          { periodYear: { lt: currentPeriod.year } },
          {
            AND: [
              { periodYear: currentPeriod.year },
              { periodMonth: { lt: currentPeriod.month } },
            ],
          },
        ],
      },
    },
    select: {
      periodQty: true,
      periodAmount: true,
      periodProgressPct: true,
    },
  })

  const prevQty = prevCerts.reduce((sum, l) => sum.add(l.periodQty), new Prisma.Decimal(0))
  const prevAmount = prevCerts.reduce((sum, l) => sum.add(l.periodAmount), new Prisma.Decimal(0))
  const prevPct = prevCerts.reduce((sum, l) => sum.add(l.periodProgressPct), new Prisma.Decimal(0))

  return { prevQty, prevAmount, prevPct }
}

export async function createCertification(
  projectId: string,
  data: {
    periodMonth: number
    periodYear: number
    budgetVersionId: string
    notes?: string
    issuedDate?: string
  }
) {
  await requirePermission('CERTIFICATIONS', 'create')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
  })
  if (!project) throw new Error('Project not found')
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const number = await generateCertNumber(projectId)
  const issuedDateValue = data.issuedDate ? new Date(data.issuedDate) : undefined

  const cert = await prisma.$transaction(async (tx) => {
    const created = await tx.certification.create({
      data: {
        orgId: org.orgId,
        projectId,
        budgetVersionId: data.budgetVersionId,
        number,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        status: 'DRAFT',
        notes: data.notes,
        issuedDate: issuedDateValue,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CERTIFICATION.CREATED',
      entityType: 'Certification',
      entityId: created.id,
      payload: { projectId, number: created.number },
    })
    return created
  })

  revalidatePath(`/projects/${projectId}/certifications`)
  revalidatePath(`/projects/${projectId}/finance/certifications`)
  return { success: true, certId: cert.id }
}

export async function addCertificationLine(
  certId: string,
  data: {
    wbsNodeId: string
    budgetLineId: string
    periodProgressPct: number
  }
) {
  const { org } = await getAuthContext()

  const cert = await prisma.certification.findFirst({
    where: { id: certId, orgId: org.orgId, status: 'DRAFT' },
  })
  if (!cert) throw new Error('Certification not found or not editable')
  try {
    const access = await assertProjectAccess(cert.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const budgetLine = await prisma.budgetLine.findUnique({
    where: { id: data.budgetLineId },
    select: {
      quantity: true,
      salePriceTotal: true,
    },
  })
  if (!budgetLine) throw new Error('Budget line not found')

  const contractualQty = budgetLine.quantity
  const unitPrice =
    contractualQty.greaterThan(0) ? budgetLine.salePriceTotal.div(contractualQty) : new Prisma.Decimal(0)

  const { prevQty, prevAmount, prevPct } = await calculatePrevProgress(data.budgetLineId, {
    month: cert.periodMonth,
    year: cert.periodYear,
  })

  const periodProgressPct = new Prisma.Decimal(data.periodProgressPct)
  const totalProgressPct = prevPct.add(periodProgressPct)

  if (totalProgressPct.greaterThan(100)) {
    throw new Error('Total progress cannot exceed 100%')
  }

  const periodQty = contractualQty.mul(periodProgressPct).div(100)
  const totalQty = prevQty.add(periodQty)
  const remainingQty = contractualQty.sub(totalQty)

  const periodAmount = periodQty.mul(unitPrice)
  const totalAmount = prevAmount.add(periodAmount)

  await prisma.certificationLine.create({
    data: {
      orgId: org.orgId,
      certificationId: certId,
      wbsNodeId: data.wbsNodeId,
      budgetLineId: data.budgetLineId,
      prevProgressPct: prevPct,
      periodProgressPct,
      totalProgressPct,
      contractualQtySnapshot: contractualQty,
      unitPriceSnapshot: unitPrice,
      prevQty,
      periodQty,
      totalQty,
      remainingQty,
      prevAmount,
      periodAmount,
      totalAmount,
    },
  })

  revalidatePath(`/projects/${cert.projectId}/certifications`)
  revalidatePath(`/projects/${cert.projectId}/certifications/${certId}`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications/${certId}`)
  return { success: true }
}

export async function deleteCertificationLine(lineId: string) {
  const { org } = await getAuthContext()

  const line = await prisma.certificationLine.findFirst({
    where: { id: lineId, orgId: org.orgId },
    include: {
      certification: { select: { projectId: true, status: true } },
    },
  })
  if (!line) throw new Error('Line not found')
  if (line.certification.status !== 'DRAFT') {
    throw new Error('Cannot delete line from issued or approved certification')
  }
  try {
    const access = await assertProjectAccess(line.certification.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.$transaction(async (tx) => {
    await tx.certificationLine.delete({
      where: { id: lineId },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CERTIFICATION.UPDATED',
      entityType: 'CertificationLine',
      entityId: lineId,
      payload: { certificationId: line.certificationId, projectId: line.certification.projectId, deleted: true },
    })
  })

  revalidatePath(`/projects/${line.certification.projectId}/certifications`)
  revalidatePath(`/projects/${line.certification.projectId}/certifications/${line.certificationId}`)
  revalidatePath(`/projects/${line.certification.projectId}/finance/certifications`)
  revalidatePath(`/projects/${line.certification.projectId}/finance/certifications/${line.certificationId}`)
  return { success: true }
}

export async function deleteCertification(certId: string) {
  await requirePermission('CERTIFICATIONS', 'delete')
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const cert = await prisma.certification.findFirst({
    where: { id: certId, orgId: org.orgId },
    select: { id: true, projectId: true, status: true },
  })
  if (!cert) throw new Error('Certificación no encontrada')
  if (cert.status === 'APPROVED') {
    throw new Error('No se puede eliminar una certificación aprobada')
  }
  try {
    const access = await assertProjectAccess(cert.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.certificationLine.deleteMany({ where: { certificationId: certId } })
  await prisma.certification.delete({ where: { id: certId } })

  revalidatePath(`/projects/${cert.projectId}/certifications`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications`)
  return { success: true }
}

export async function updateCertification(
  certId: string,
  data: { notes?: string; periodMonth?: number; periodYear?: number; issuedDate?: string | null }
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const cert = await prisma.certification.findFirst({
    where: { id: certId, orgId: org.orgId, status: 'DRAFT' },
    select: { id: true, projectId: true },
  })
  if (!cert) throw new Error('Certificación no encontrada o no está en borrador')
  try {
    const access = await assertProjectAccess(cert.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const updateData: {
    notes?: string
    periodMonth?: number
    periodYear?: number
    issuedDate?: Date | null
  } = {}
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.periodMonth !== undefined) updateData.periodMonth = data.periodMonth
  if (data.periodYear !== undefined) updateData.periodYear = data.periodYear
  if (data.issuedDate !== undefined) updateData.issuedDate = data.issuedDate ? new Date(data.issuedDate) : null

  await prisma.$transaction(async (tx) => {
    await tx.certification.update({
      where: { id: certId },
      data: updateData,
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CERTIFICATION.UPDATED',
      entityType: 'Certification',
      entityId: certId,
      payload: { projectId: cert.projectId },
    })
  })

  revalidatePath(`/projects/${cert.projectId}/certifications`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications/${certId}`)
  return { success: true }
}

async function getNextCertTransactionNumber(orgId: string): Promise<string> {
  const last = await prisma.financeTransaction.findFirst({
    where: { orgId, transactionNumber: { startsWith: 'TXN-' } },
    orderBy: { transactionNumber: 'desc' },
    select: { transactionNumber: true },
  })
  const lastNum = last?.transactionNumber?.match(/\d+$/)?.[0] ?? '0'
  return `TXN-${String(Number(lastNum) + 1).padStart(6, '0')}`
}

export async function issueCertification(certId: string) {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const cert = await prisma.certification.findFirst({
    where: { id: certId, orgId: org.orgId, status: 'DRAFT' },
    include: { lines: true, project: { select: { name: true } } },
  })

  if (!cert) throw new Error('Certification not found')
  if (cert.lines.length === 0) throw new Error('Cannot issue empty certification')
  try {
    const access = await assertProjectAccess(cert.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const data = JSON.stringify({
    id: cert.id,
    number: cert.number,
    period: { month: cert.periodMonth, year: cert.periodYear },
    lines: cert.lines.map((l) => ({
      wbsNodeId: l.wbsNodeId,
      budgetLineId: l.budgetLineId,
      periodQty: l.periodQty.toString(),
      unitPrice: l.unitPriceSnapshot.toString(),
      periodAmount: l.periodAmount.toString(),
    })),
  })
  const integritySeal = crypto.createHash('sha256').update(data).digest('hex')

  const issuedDate = new Date()
  const totalAmount = cert.lines.reduce((sum, l) => sum.add(l.periodAmount), new Prisma.Decimal(0))
  const transactionNumber = await getNextCertTransactionNumber(org.orgId)

  await prisma.$transaction(async (tx) => {
    await tx.certification.update({
      where: { id: certId },
      data: {
        status: 'ISSUED',
        integritySeal,
        issuedByOrgMemberId: org.memberId,
        issuedAt: issuedDate,
        issuedDate,
      },
    })

    await tx.financeTransaction.create({
      data: {
        orgId: org.orgId,
        projectId: cert.projectId,
        certificationId: cert.id,
        type: 'INCOME',
        documentType: 'INVOICE',
        status: 'SUBMITTED',
        transactionNumber,
        issueDate: issuedDate,
        currency: 'USD',
        subtotal: totalAmount,
        taxTotal: new Prisma.Decimal(0),
        total: totalAmount,
        amountBaseCurrency: totalAmount,
        exchangeRateSnapshot: { rate: 1, baseCurrency: 'USD' } as object,
        description: `Certificación #${cert.number} - ${cert.project.name}`,
        reference: `CERT-${cert.number}`,
        createdByOrgMemberId: org.memberId,
      },
    })

    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CERTIFICATION.ISSUED',
      entityType: 'Certification',
      entityId: certId,
      payload: { projectId: cert.projectId, number: cert.number },
    })
  })

  const admins = await prisma.orgMember.findMany({
    where: { orgId: org.orgId, active: true, role: { in: ['ADMIN', 'OWNER'] } },
    select: { userId: true },
  })
  const adminUserIds = admins.map((a) => a.userId).filter((id) => id !== session.user.id)
  if (adminUserIds.length > 0) {
    const { createInAppNotificationsForUsers } = await import('@/app/actions/notifications')
    await createInAppNotificationsForUsers(adminUserIds, {
      orgId: org.orgId,
      actorUserId: session.user.id,
      category: 'CERTIFICATION_ISSUED',
      title: 'Certificación emitida',
      message: `Certificación #${cert.number} - ${cert.project.name} pendiente de aprobación.`,
      metadata: { link: `/projects/${cert.projectId}/finance/certifications/${certId}` },
    })
  }

  revalidatePath(`/projects/${cert.projectId}/certifications`)
  revalidatePath(`/projects/${cert.projectId}/certifications/${certId}`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications/${certId}`)
  revalidatePath(`/projects/${cert.projectId}/finance/transactions`)
  return { success: true }
}

export async function getCertification(certId: string) {
  const { org } = await getAuthContext()
  const cert = await prisma.certification.findFirst({
    where: { id: certId, orgId: org.orgId },
    include: {
      project: { select: { id: true, name: true, projectNumber: true } },
      budgetVersion: { select: { id: true, versionCode: true } },
      issuedBy: { select: { user: { select: { fullName: true } } } },
      approvedBy: { select: { user: { select: { fullName: true } } } },
      lines: {
        include: {
          wbsNode: { select: { code: true, name: true } },
          budgetLine: { select: { description: true, unit: true } },
        },
        orderBy: [{ wbsNode: { sortOrder: 'asc' } }, { wbsNode: { code: 'asc' } }],
      },
    },
  })
  if (cert?.projectId) {
    try {
      await assertProjectAccess(cert.projectId, org)
    } catch {
      return null
    }
  }
  return cert
}

export async function getBudgetLinesForCert(budgetVersionId: string) {
  const { org } = await getAuthContext()
  const version = await prisma.budgetVersion.findFirst({
    where: { id: budgetVersionId, orgId: org.orgId },
    select: { projectId: true },
  })
  if (!version?.projectId) return []
  try {
    await assertProjectAccess(version.projectId, org)
  } catch {
    return []
  }
  const lines = await prisma.budgetLine.findMany({
    where: {
      budgetVersionId,
      budgetVersion: { orgId: org.orgId },
    },
    include: {
      wbsNode: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ wbsNode: { sortOrder: 'asc' } }, { wbsNode: { code: 'asc' } }, { sortOrder: 'asc' }],
  })
  return lines.map((bl) => ({
    id: bl.id,
    wbsNodeId: bl.wbsNodeId,
    description: bl.description,
    quantity: Number(bl.quantity),
    salePriceTotal: Number(bl.salePriceTotal),
    wbsNode: bl.wbsNode ? { id: bl.wbsNode.id, code: bl.wbsNode.code, name: bl.wbsNode.name } : null,
  }))
}

/** Prev progress % by budgetLineId (from approved certs before current period). For UI validation: period % + prev <= 100. */
export async function getPrevProgressForBudgetLines(
  budgetVersionId: string,
  periodMonth: number,
  periodYear: number,
  budgetLineIds: string[]
): Promise<Record<string, number>> {
  const { org } = await getAuthContext()
  const version = await prisma.budgetVersion.findFirst({
    where: { id: budgetVersionId, orgId: org.orgId },
    select: { projectId: true },
  })
  if (version?.projectId) {
    try {
      await assertProjectAccess(version.projectId, org)
    } catch {
      return {}
    }
  }
  const result: Record<string, number> = {}
  for (const budgetLineId of budgetLineIds) {
    const { prevPct } = await calculatePrevProgress(budgetLineId, { month: periodMonth, year: periodYear })
    result[budgetLineId] = Number(prevPct)
  }
  return result
}

export async function approveCertification(certId: string) {
  await requirePermission('CERTIFICATIONS', 'approve')
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const cert = await prisma.certification.findFirst({
    where: { id: certId, orgId: org.orgId, status: 'ISSUED' },
    select: { id: true, projectId: true, number: true, issuedByOrgMemberId: true },
  })

  if (!cert) throw new Error('Certification not found or not issued')
  try {
    const access = await assertProjectAccess(cert.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.$transaction(async (tx) => {
    await tx.certification.update({
      where: { id: certId },
      data: {
        status: 'APPROVED',
        approvedByOrgMemberId: org.memberId,
        approvedAt: new Date(),
      },
    })

    await tx.financeTransaction.updateMany({
      where: {
        projectId: cert.projectId,
        orgId: org.orgId,
        reference: `CERT-${cert.number}`,
        type: 'INCOME',
      },
      data: { status: 'PAID', paidDate: new Date() },
    })

    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CERTIFICATION.APPROVED',
      entityType: 'Certification',
      entityId: certId,
      payload: { projectId: cert.projectId, number: cert.number },
    })
  })

  if (cert.issuedByOrgMemberId && cert.issuedByOrgMemberId !== org.memberId) {
    const issuer = await prisma.orgMember.findUnique({
      where: { id: cert.issuedByOrgMemberId },
      select: { userId: true },
    })
    if (issuer) {
      const { createInAppNotification } = await import('@/app/actions/notifications')
      await createInAppNotification({
        orgId: org.orgId,
        userId: issuer.userId,
        actorUserId: session.user.id,
        category: 'CERTIFICATION_APPROVED',
        title: 'Certificación aprobada',
        message: `Certificación #${cert.number} fue aprobada.`,
        metadata: { link: `/projects/${cert.projectId}/finance/certifications/${certId}` },
      })
    }
  }

  revalidatePath(`/projects/${cert.projectId}/certifications`)
  revalidatePath(`/projects/${cert.projectId}/certifications/${certId}`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications/${certId}`)
  revalidatePath(`/projects/${cert.projectId}/finance/transactions`)
  return { success: true }
}

export async function rejectCertification(certId: string, notes?: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const cert = await prisma.certification.findFirst({
    where: { id: certId, orgId: org.orgId, status: 'ISSUED' },
    select: { id: true, projectId: true, notes: true },
  })

  if (!cert) throw new Error('Certification not found or not issued')
  try {
    const access = await assertProjectAccess(cert.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.REPORTS)) {
      throw new Error('No tenés permiso para editar certificaciones de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.$transaction(async (tx) => {
    await tx.certification.update({
      where: { id: certId },
      data: {
        status: 'REJECTED',
        approvedByOrgMemberId: org.memberId,
        approvedAt: new Date(),
        notes: notes ?? cert.notes ?? undefined,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'CERTIFICATION.REJECTED',
      entityType: 'Certification',
      entityId: certId,
      payload: { projectId: cert.projectId },
    })
  })

  revalidatePath(`/projects/${cert.projectId}/certifications`)
  revalidatePath(`/projects/${cert.projectId}/certifications/${certId}`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications`)
  revalidatePath(`/projects/${cert.projectId}/finance/certifications/${certId}`)
  return { success: true }
}

export async function getProjectCertifications(projectId: string) {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return []
  }
  const certifications = await prisma.certification.findMany({
    where: { projectId, orgId: org.orgId },
    orderBy: { number: 'desc' },
    include: {
      budgetVersion: { select: { versionCode: true } },
      issuedBy: { select: { user: { select: { fullName: true } } } },
      approvedBy: { select: { user: { select: { fullName: true } } } },
      lines: { select: { periodAmount: true } },
    },
  })
  return certifications.map((cert) => ({
    id: cert.id,
    number: cert.number,
    periodMonth: cert.periodMonth,
    periodYear: cert.periodYear,
    status: cert.status,
    totalAmount: cert.lines.reduce((sum, line) => sum + Number(line.periodAmount), 0),
    issuedDate: cert.issuedDate,
    issuedAt: cert.issuedAt,
    approvedAt: cert.approvedAt,
    issuedBy: cert.issuedBy,
    approvedBy: cert.approvedBy,
    budgetVersion: cert.budgetVersion,
  }))
}
