'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole, hasMinimumRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { uploadToR2, getDownloadUrl, calculateChecksum } from '@/lib/r2-client'
import {
  createDailyReportSchema,
  updateDailyReportSchema,
  type CreateDailyReportInput,
  type UpdateDailyReportInput,
} from '@repo/validators'
import {
  updateWbsProgressOnSubmit,
  updateBudgetLineActuals,
  generateAlertsForReport,
} from './daily-reports-tier2'

const MAX_FILES_PER_REPORT = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

async function auditDailyReport(params: {
  orgId: string
  projectId: string
  actorUserId: string
  action: string
  entityId: string
  detailsJson: Record<string, unknown>
}) {
  await prisma.auditLog.create({
    data: {
      orgId: params.orgId,
      projectId: params.projectId,
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: 'DailyReport',
      entityId: params.entityId,
      detailsJson: params.detailsJson as Prisma.InputJsonValue,
    },
  })
}

/** Project.status values that allow creating/editing daily reports (obra iniciada). */
const ALLOWED_DAILY_REPORT_PROJECT_STATUSES = ['ACTIVE'] as const

function ensureProjectInOrg(projectId: string, orgId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true, name: true, projectNumber: true, status: true },
  })
}

/** Throws if project is not in a status that allows daily reports (e.g. ACTIVE). */
function ensureProjectAllowsDailyReports(project: { status: string } | null): void {
  if (!project) throw new Error('Proyecto no encontrado')
  if (!ALLOWED_DAILY_REPORT_PROJECT_STATUSES.includes(project.status as (typeof ALLOWED_DAILY_REPORT_PROJECT_STATUSES)[number])) {
    throw new Error(`Obra no iniciada. No se pueden crear ni editar reportes. Estado actual del proyecto: ${project.status}`)
  }
}

export type ListDailyReportsFilters = {
  status?: string[]
  authorOrgMemberId?: string[]
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

export type DailyReportListItem = {
  id: string
  reportDate: Date
  summary: string
  status: string
  createdByOrgMemberId: string
  authorName: string
  approvedByName: string | null
  wbsSummary: string | null
  photoCount: number
}

export async function listDailyReports(
  projectId: string,
  filters: ListDailyReportsFilters = {},
  page = 1,
  pageSize = 25
) {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return { items: [] as DailyReportListItem[], total: 0, project: null }
  }
  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return { items: [] as DailyReportListItem[], total: 0, project: null }

  const where: {
    projectId: string
    orgId: string
    reportDate?: { gte?: Date; lte?: Date }
    status?: { in: string[] }
    createdByOrgMemberId?: { in: string[] }
    OR?: { workAccomplished?: { contains: string; mode: 'insensitive' } }[]
  } = { projectId, orgId: org.orgId }

  if (filters.dateFrom) where.reportDate = { ...where.reportDate, gte: filters.dateFrom }
  if (filters.dateTo) where.reportDate = { ...where.reportDate, lte: filters.dateTo }
  if (filters.status?.length) where.status = { in: filters.status }
  if (filters.authorOrgMemberId?.length) where.createdByOrgMemberId = { in: filters.authorOrgMemberId }
  if (filters.search?.trim()) {
    where.OR = [{ workAccomplished: { contains: filters.search.trim(), mode: 'insensitive' } }]
  }

  const baseSelectLegacy = {
    id: true,
    reportDate: true,
    workAccomplished: true,
    createdByOrgMemberId: true,
    createdBy: { select: { user: { select: { fullName: true } } } },
    approvedBy: { select: { user: { select: { fullName: true } } } },
    wbsNode: { select: { code: true, name: true } },
    _count: { select: { photos: true } },
  } as const

  type BaseRow = {
    id: string
    reportDate: Date
    workAccomplished: string | null
    createdByOrgMemberId: string
    createdBy: { user: { fullName: string } }
    approvedBy: { user: { fullName: string } } | null
    wbsNode: { code: string; name: string } | null
    _count: { photos: number }
    summary?: string
    status?: string
    wbsNodes?: { wbsNode: { code: string; name: string } }[]
  }

  let items: BaseRow[]
  try {
    const result = await prisma.dailyReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        ...baseSelectLegacy,
        wbsNodes: { select: { wbsNode: { select: { code: true, name: true } } } },
        summary: true,
        status: true,
      },
    })
    items = result as BaseRow[]
  } catch {
    try {
      const result = await prisma.dailyReport.findMany({
        where: { ...where, status: undefined },
        orderBy: { reportDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { ...baseSelectLegacy, summary: true, status: true },
      })
      items = result.map((r) => ({ ...r, wbsNodes: undefined })) as BaseRow[]
    } catch {
      const result = await prisma.dailyReport.findMany({
        where: { ...where, status: undefined },
        orderBy: { reportDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: baseSelectLegacy,
      })
      items = result.map((r) => ({ ...r, summary: undefined, status: undefined, wbsNodes: undefined })) as BaseRow[]
    }
  }
  const total = await prisma.dailyReport.count({ where })

  const list: DailyReportListItem[] = items.map((r) => {
    const extended = r as BaseRow & { wbsNodes?: { wbsNode: { code: string; name: string } }[] }
    const wbsNodes = extended.wbsNodes
    const wbsParts =
      wbsNodes && wbsNodes.length > 0
        ? wbsNodes.map((n) => `${n.wbsNode.code} — ${n.wbsNode.name}`)
        : r.wbsNode
          ? [`${r.wbsNode.code} — ${r.wbsNode.name}`]
          : []
    return {
      id: r.id,
      reportDate: r.reportDate,
      summary: r.summary ?? r.workAccomplished?.slice(0, 200) ?? '',
      status: r.status ?? 'DRAFT',
      createdByOrgMemberId: r.createdByOrgMemberId,
      authorName: r.createdBy?.user?.fullName ?? '',
      approvedByName: r.approvedBy?.user?.fullName ?? null,
      wbsSummary: wbsParts.length > 0 ? wbsParts.join(' · ') : null,
      photoCount: r._count?.photos ?? 0,
    }
  })

  return { items: list, total, project: { id: project.id, name: project.name, projectNumber: project.projectNumber } }
}

const getDailyReportIncludeBase = {
  project: { select: { id: true, name: true, projectNumber: true } },
  createdBy: { select: { id: true, user: { select: { fullName: true, email: true } } } },
  approvedBy: { select: { id: true, user: { select: { fullName: true } } } },
  wbsNode: { select: { id: true, code: true, name: true } },
  labor: true,
  equipment: true,
  photos: {
    orderBy: { sortOrder: 'asc' },
    include: { document: { include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } } } },
  },
} as const

/** Prisma Decimal is not serializable to client; convert to number for RSC → Client. */
function toPlainObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (typeof (obj as { toNumber?: () => number }).toNumber === 'function')
    return (obj as { toNumber: () => number }).toNumber() as unknown as T
  if (obj instanceof Date) return obj
  if (Array.isArray(obj)) return obj.map((item) => toPlainObject(item)) as unknown as T
  if (typeof obj === 'object' && obj.constructor?.name === 'Object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = toPlainObject(v)
    return out as T
  }
  return obj
}

export async function getDailyReport(reportId: string) {
  const { org } = await getAuthContext()
  let report: { projectId: string; [k: string]: unknown } | null = null
  try {
    report = await prisma.dailyReport.findFirst({
      where: { id: reportId, orgId: org.orgId },
      include: {
        ...getDailyReportIncludeBase,
        wbsNodes: { select: { wbsNode: { select: { id: true, code: true, name: true } } } },
      },
    })
  } catch {
    report = await prisma.dailyReport.findFirst({
      where: { id: reportId, orgId: org.orgId },
      include: getDailyReportIncludeBase,
    })
    if (report) (report as { wbsNodes?: unknown }).wbsNodes = []
  }
  if (!report) return null
  try {
    await assertProjectAccess(report.projectId, org)
  } catch {
    return null
  }
  return toPlainObject(report)
}

export async function createDailyReport(projectId: string, data: CreateDailyReportInput) {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) throw new Error('Proyecto no encontrado')
  ensureProjectAllowsDailyReports(project)
  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const parsed = createDailyReportSchema.safeParse({ ...data, projectId })
  if (!parsed.success) throw new Error(parsed.error.errors.map((e) => e.message).join(', '))

  const { laborEntries, wbsNodeIds, ...rest } = parsed.data
  const reportDate = rest.reportDate instanceof Date ? rest.reportDate : new Date(rest.reportDate)
  const wbsIds = (wbsNodeIds ?? []).filter(Boolean)
  const firstWbsId = wbsIds.length === 1 ? wbsIds[0] : wbsIds.length > 0 ? wbsIds[0] : null

  const baseData = {
    orgId: org.orgId,
    projectId,
    reportDate,
    workAccomplished:
      (rest.summary ? rest.summary + '\n\n' : '') + (rest.workAccomplished || '') || null,
    observations: rest.observations || null,
    safetyIncidents: rest.safetyIncidents || null,
    weather: rest.weather ?? null,
    createdByOrgMemberId: org.memberId,
    wbsNodeId: rest.wbsNodeId ?? firstWbsId ?? null,
  }

  let report: { id: string; projectId: string; status?: string } & Record<string, unknown>
  try {
    report = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyReport.create({
        data: {
          ...baseData,
          summary: rest.summary,
          status: 'DRAFT',
        } as Parameters<typeof tx.dailyReport.create>[0]['data'],
      })
      if (laborEntries.length) {
        await tx.dailyReportLabor.createMany({
          data: laborEntries.map((e) => ({
            orgId: org.orgId,
            dailyReportId: created.id,
            trade: e.speciality,
            workerCount: e.quantity,
            hoursWorked: e.hours,
          })),
        })
      }
      if (wbsIds.length > 0) {
        await tx.dailyReportWbsNode.createMany({
          data: wbsIds.map((wbsNodeId) => ({
            dailyReportId: created.id,
            wbsNodeId,
          })),
        })
      }
      return created
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unknown argument') && (msg.includes('summary') || msg.includes('status'))) {
      report = await prisma.$transaction(async (tx) => {
        const created = await tx.dailyReport.create({
          data: baseData as Parameters<typeof tx.dailyReport.create>[0]['data'],
        })
        if (laborEntries.length) {
          await tx.dailyReportLabor.createMany({
            data: laborEntries.map((e) => ({
              orgId: org.orgId,
              dailyReportId: created.id,
              trade: e.speciality,
              workerCount: e.quantity,
              hoursWorked: e.hours,
            })),
          })
        }
        return { ...created, status: 'DRAFT' as const }
      })
    } else {
      throw err
    }
  }

  await auditDailyReport({
    orgId: org.orgId,
    projectId,
    actorUserId: session.user.id,
    action: 'CREATE',
    entityId: report.id,
    detailsJson: { event: 'saved_as_draft', status: 'DRAFT', summary: rest.summary },
  })
  revalidatePath(`/projects/${projectId}/daily-reports`)
  return report
}

export async function updateDailyReport(reportId: string, data: UpdateDailyReportInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
    include: { labor: true, project: { select: { status: true } } },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  ensureProjectAllowsDailyReports(existing.project)
  if (existing.status !== 'DRAFT') throw new Error('Solo se pueden editar reportes en borrador')
  const isAuthor = existing.createdByOrgMemberId === org.memberId
  const isAdmin = hasMinimumRole(org.role, 'ADMIN')
  if (!isAuthor && !isAdmin) throw new Error('No tienes permiso para editar este reporte')
  try {
    const access = await assertProjectAccess(existing.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const parsed = updateDailyReportSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.errors.map((e) => e.message).join(', '))

  const { laborEntries, wbsNodeIds, ...rest } = parsed.data
  const wbsIds = (wbsNodeIds ?? []).filter(Boolean)
  const firstWbsId = wbsIds.length === 1 ? wbsIds[0] : wbsIds.length > 0 ? wbsIds[0] : null

  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.dailyReport.update({
      where: { id: reportId },
      data: {
        ...(rest.reportDate && { reportDate: rest.reportDate }),
        ...(rest.summary && { summary: rest.summary }),
        ...(rest.workAccomplished !== undefined && { workAccomplished: rest.workAccomplished || null }),
        ...(rest.observations !== undefined && { observations: rest.observations || null }),
        ...(rest.safetyIncidents !== undefined && { safetyIncidents: rest.safetyIncidents || null }),
        ...(rest.weather !== undefined && { weather: rest.weather ?? null }),
        ...(wbsNodeIds !== undefined ? { wbsNodeId: firstWbsId ?? null } : rest.wbsNodeId !== undefined ? { wbsNodeId: rest.wbsNodeId ?? null } : {}),
      },
    })
    if (laborEntries !== undefined) {
      await tx.dailyReportLabor.deleteMany({ where: { dailyReportId: reportId } })
      if (laborEntries.length) {
        await tx.dailyReportLabor.createMany({
          data: laborEntries.map((e) => ({
            orgId: org.orgId,
            dailyReportId: reportId,
            trade: e.speciality,
            workerCount: e.quantity,
            hoursWorked: e.hours,
          })),
        })
      }
    }
    if (wbsNodeIds !== undefined) {
      await tx.dailyReportWbsNode.deleteMany({ where: { dailyReportId: reportId } })
      if (wbsIds.length > 0) {
        await tx.dailyReportWbsNode.createMany({
          data: wbsIds.map((wbsNodeId) => ({
            dailyReportId: reportId,
            wbsNodeId,
          })),
        })
      }
    }
    return updated
  })

  revalidatePath(`/projects/${existing.projectId}/daily-reports`)
  revalidatePath(`/projects/${existing.projectId}/daily-reports/${reportId}`)
  return report
}

export async function deleteDailyReport(reportId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  if (existing.status !== 'DRAFT') throw new Error('Solo se pueden eliminar reportes en borrador')
  const isAuthor = existing.createdByOrgMemberId === org.memberId
  const isAdmin = hasMinimumRole(org.role, 'ADMIN')
  if (!isAuthor && !isAdmin) throw new Error('No tienes permiso para eliminar este reporte')
  try {
    const access = await assertProjectAccess(existing.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  await prisma.dailyReport.delete({ where: { id: reportId } })
  revalidatePath(`/projects/${existing.projectId}/daily-reports`)
}

export async function submitDailyReport(reportId: string) {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  if (existing.status !== 'DRAFT') throw new Error('Solo reportes en borrador pueden enviarse')
  if (existing.createdByOrgMemberId !== org.memberId) throw new Error('Solo el autor puede enviar el reporte')
  try {
    const access = await assertProjectAccess(existing.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const submittedAt = new Date()
  const report = await prisma.dailyReport.update({
    where: { id: reportId },
    data: { status: 'SUBMITTED', submittedAt },
  })
  await auditDailyReport({
    orgId: org.orgId,
    projectId: existing.projectId,
    actorUserId: session.user.id,
    action: 'UPDATE',
    entityId: reportId,
    detailsJson: { event: 'submitted', status: 'SUBMITTED', submittedAt: submittedAt.toISOString() },
  })
  revalidatePath(`/projects/${existing.projectId}/daily-reports`)
  revalidatePath(`/projects/${existing.projectId}/daily-reports/${reportId}`)
  return report
}

export async function approveDailyReport(reportId: string, _adminNotes?: string) {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  if (existing.status !== 'SUBMITTED') throw new Error('Solo reportes enviados pueden aprobarse')
  try {
    const access = await assertProjectAccess(existing.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const approvedAt = new Date()
  const report = await prisma.dailyReport.update({
    where: { id: reportId },
    data: { status: 'APPROVED', approvedByOrgMemberId: org.memberId, approvedAt },
  })

  // Tier 2: update WBS progress, budget actuals, and generate alerts (each no-ops when not applicable)
  await updateWbsProgressOnSubmit(reportId)
  await updateBudgetLineActuals(reportId)
  await generateAlertsForReport(reportId)

  await auditDailyReport({
    orgId: org.orgId,
    projectId: existing.projectId,
    actorUserId: session.user.id,
    action: 'APPROVE',
    entityId: reportId,
    detailsJson: { event: 'approved', status: 'APPROVED', approvedAt: approvedAt.toISOString() },
  })
  revalidatePath(`/projects/${existing.projectId}/daily-reports`)
  revalidatePath(`/projects/${existing.projectId}/daily-reports/${reportId}`)
  return report
}

export async function rejectDailyReport(reportId: string, reason: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  if (existing.status !== 'SUBMITTED') throw new Error('Solo reportes enviados pueden rechazarse')
  try {
    const access = await assertProjectAccess(existing.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const report = await prisma.dailyReport.update({
    where: { id: reportId },
    data: {
      status: 'DRAFT',
      submittedAt: null,
      approvedByOrgMemberId: null,
      approvedAt: null,
      observations: [existing.observations, `[Rechazo: ${reason}]`].filter(Boolean).join('\n'),
    },
  })
  revalidatePath(`/projects/${existing.projectId}/daily-reports`)
  revalidatePath(`/projects/${existing.projectId}/daily-reports/${reportId}`)
  return report
}

export async function publishDailyReport(reportId: string) {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  if (existing.status !== 'APPROVED') throw new Error('Solo reportes aprobados pueden publicarse')
  try {
    const access = await assertProjectAccess(existing.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const report = await prisma.dailyReport.update({
    where: { id: reportId },
    data: { status: 'PUBLISHED' },
  })
  await auditDailyReport({
    orgId: org.orgId,
    projectId: existing.projectId,
    actorUserId: session.user.id,
    action: 'UPDATE',
    entityId: reportId,
    detailsJson: { event: 'published', status: 'PUBLISHED', publishedAt: new Date().toISOString() },
  })
  revalidatePath(`/projects/${existing.projectId}/daily-reports`)
  revalidatePath(`/projects/${existing.projectId}/daily-reports/${reportId}`)
  return report
}

export async function uploadDailyReportFiles(
  reportId: string,
  projectId: string,
  formData: FormData
): Promise<{ fileUrl: string; documentId: string; photoId: string }[]> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await prisma.dailyReport.findFirst({
    where: { id: reportId, orgId: org.orgId },
    include: { _count: { select: { photos: true } } },
  })
  if (!existing) throw new Error('Reporte no encontrado')
  if (existing.status !== 'DRAFT') throw new Error('Solo se pueden subir archivos a reportes en borrador')
  if (existing.createdByOrgMemberId !== org.memberId && !hasMinimumRole(org.role, 'ADMIN'))
    throw new Error('No tienes permiso para subir archivos a este reporte')
  try {
    const access = await assertProjectAccess(existing.projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DAILY_REPORTS)) {
      throw new Error('No tenés permiso para editar reportes diarios de este proyecto')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permiso')) throw e
    throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
  }

  const files = formData.getAll('files') as File[]
  if (!files.length) return []
  const currentCount = existing._count.photos
  if (currentCount + files.length > MAX_FILES_PER_REPORT)
    throw new Error(`Máximo ${MAX_FILES_PER_REPORT} archivos por reporte`)

  const results: { fileUrl: string; documentId: string; photoId: string }[] = []

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`Archivo ${file.name} supera 10MB`)
    const mime = (file.type || '').toLowerCase()
    const isAllowed = allowedMimes.includes(mime) || mime.startsWith('image/')
    if (!isAllowed) throw new Error(`Tipo de archivo no permitido: ${file.name}`)
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (currentCount + results.length >= MAX_FILES_PER_REPORT) break
    if (file.size > MAX_FILE_BYTES) continue // skip oversized file
    const mime = (file.type || '').toLowerCase()
    const isAllowed = allowedMimes.includes(mime) || mime.startsWith('image/')
    if (!isAllowed) continue

    const checksum = await calculateChecksum(file)
    const storageKeyPrefix = `${org.orgId}`
    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          orgId: org.orgId,
          projectId,
          title: file.name,
          docType: 'DAILY_REPORT_PHOTO',
          category: 'Libro de Obra',
          createdByOrgMemberId: org.memberId,
        },
      })
      const storageKey = `${storageKeyPrefix}/${created.id}/1/${file.name}`
      await uploadToR2(file, storageKey)
      await tx.documentVersion.create({
        data: {
          orgId: org.orgId,
          documentId: created.id,
          versionNumber: 1,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storageKey,
          checksum,
          uploadedByOrgMemberId: org.memberId,
        },
      })
      const photo = await tx.dailyReportPhoto.create({
        data: {
          orgId: org.orgId,
          dailyReportId: reportId,
          documentId: created.id,
          sortOrder: currentCount + results.length,
        },
      })
      return { doc: created, photo, storageKey }
    })
    const url = await getDownloadUrl(doc.storageKey)
    results.push({ fileUrl: url, documentId: doc.doc.id, photoId: doc.photo.id })
  }

  revalidatePath(`/projects/${projectId}/daily-reports`)
  revalidatePath(`/projects/${projectId}/daily-reports/${reportId}`)
  return results
}

export async function getWbsNodesForProject(projectId: string) {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return []
  }
  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return []
  return prisma.wbsNode.findMany({
    where: { projectId, orgId: org.orgId, active: true },
    select: { id: true, code: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })
}

export async function getAuthorsForProject(projectId: string) {
  const { org } = await getAuthContext()
  try {
    await assertProjectAccess(projectId, org)
  } catch {
    return []
  }
  const project = await ensureProjectInOrg(projectId, org.orgId)
  if (!project) return []
  const members = await prisma.dailyReport.findMany({
    where: { projectId, orgId: org.orgId },
    distinct: ['createdByOrgMemberId'],
    select: {
      createdByOrgMemberId: true,
      createdBy: { select: { user: { select: { fullName: true } } } },
    },
  })
  return members.map((m) => ({ id: m.createdByOrgMemberId, name: m.createdBy.user.fullName }))
}
