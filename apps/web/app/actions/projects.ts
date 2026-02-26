'use server'

import { redirectTo } from '@/lib/i18n-redirect'
import { revalidatePath } from 'next/cache'
import { prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { requirePermission, getAuthContext } from '@/lib/auth-helpers'
import { isRestrictedToProjects, getVisibleProjectIds } from '@/lib/org-context'
import { createAuditLog } from '@/lib/audit-log'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import {
  createProjectSchema,
  updateProjectSchema,
} from '@repo/validators'
import type { CreateProjectInput, UpdateProjectInput } from '@repo/validators'
import { Prisma } from '@repo/database'

function generateProjectNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PROJ-${year}-`
  return prisma.project
    .findMany({
      where: { orgId, projectNumber: { startsWith: prefix } },
      select: { projectNumber: true },
      orderBy: { projectNumber: 'desc' },
      take: 1,
    })
    .then((rows) => {
      const nextSeq = rows[0]
        ? parseInt(rows[0].projectNumber.replace(prefix, ''), 10) + 1
        : 1
      return `${prefix}${String(nextSeq).padStart(3, '0')}`
    })
}

export type ListProjectsFilters = {
  status?: string
  phase?: string
  search?: string
}

export async function listProjects(filters: ListProjectsFilters = {}) {
  const { org } = await getAuthContext()
  const where: Prisma.ProjectWhereInput = { orgId: org.orgId, active: true }

  const allowedProjectIds = await getVisibleProjectIds(org)
  if (Array.isArray(allowedProjectIds)) {
    where.id = { in: allowedProjectIds }
  }

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status
  }

  if (filters.phase && filters.phase !== 'all') {
    where.phase = filters.phase as 'PRE_CONSTRUCTION' | 'CONSTRUCTION' | 'CLOSEOUT' | 'COMPLETE'
  }

  if (filters.search?.trim()) {
    where.OR = [
      { name: { contains: filters.search.trim(), mode: 'insensitive' } },
      { projectNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
      { clientName: { contains: filters.search.trim(), mode: 'insensitive' } },
    ]
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      clientName: true,
      phase: true,
      status: true,
      totalBudget: true,
      location: true,
      startDate: true,
      createdAt: true,
    },
  })
  
  return projects
}

export async function createProject(data: CreateProjectInput) {
  await requirePermission('PROJECTS', 'create')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const parsed = createProjectSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const projectNumber = await generateProjectNumber(org.orgId)
  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        orgId: org.orgId,
        projectNumber,
        name: parsed.data.name,
        clientName: parsed.data.clientName ?? null,
        location: parsed.data.location ?? null,
        description: parsed.data.description ?? null,
        m2: parsed.data.m2 ?? null,
        startDate: parsed.data.startDate ?? null,
        createdByOrgMemberId: org.memberId,
        phase: 'PRE_CONSTRUCTION',
        status: 'DRAFT',
        active: true,
      },
    })
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        orgMemberId: org.memberId,
        projectRole: 'MANAGER',
        active: true,
      },
    })
    const rootFolder = await tx.documentFolder.create({
      data: {
        orgId: org.orgId,
        projectId: project.id,
        parentId: null,
        name: project.name,
      },
    })
    const defaultSubfolderNames = [
      'Planos',
      'Renders',
      'Legales',
      'Documentos comerciales',
      'Obra',
    ]
    for (const name of defaultSubfolderNames) {
      await tx.documentFolder.create({
        data: {
          orgId: org.orgId,
          projectId: project.id,
          parentId: rootFolder.id,
          name,
        },
      })
    }
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PROJECT.CREATED',
      entityType: 'Project',
      entityId: project.id,
      payload: { projectNumber: project.projectNumber, name: project.name },
    })
  })

  revalidatePath('/projects')
  return redirectTo('/projects')
}

export async function createProjectFromTemplate(data: {
  name: string
  clientName?: string
  location?: string
  description?: string
  m2?: number | null
  startDate?: string
  templateId: string
  constructionSystemIds: string[]
}) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  try {
    const projectNumber = await generateProjectNumber(org.orgId)

    const m2Val =
      data.m2 != null
        ? (typeof data.m2 === 'string' ? parseFloat(data.m2) || null : data.m2)
        : null

    const project = await prisma.project.create({
      data: {
        orgId: org.orgId,
        projectNumber,
        name: data.name,
        clientName: data.clientName || null,
        location: data.location || null,
        description: data.description || null,
        m2: m2Val != null ? new Prisma.Decimal(m2Val) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        phase: 'PRE_CONSTRUCTION',
        status: 'DRAFT',
        createdByOrgMemberId: org.memberId,
      },
    })

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        orgMemberId: org.memberId,
        projectRole: 'MANAGER',
        active: true,
      },
    })

    const rootFolder = await prisma.documentFolder.create({
      data: {
        orgId: org.orgId,
        projectId: project.id,
        parentId: null,
        name: project.name,
      },
    })
    const defaultSubfolderNames = [
      'Planos',
      'Renders',
      'Legales',
      'Documentos comerciales',
      'Obra',
    ]
    for (const name of defaultSubfolderNames) {
      await prisma.documentFolder.create({
        data: {
          orgId: org.orgId,
          projectId: project.id,
          parentId: rootFolder.id,
          name,
        },
      })
    }

    const wbsTemplates = await prisma.wbsTemplate.findMany({
      where: { projectTemplateId: data.templateId },
      orderBy: { code: 'asc' },
    })

    const filteredTemplates = wbsTemplates.filter((template) => {
      if (!template.constructionSystemId) return true
      if (data.constructionSystemIds.includes('generic')) return true
      if (data.constructionSystemIds.length === 0) return !template.constructionSystemId
      return data.constructionSystemIds.includes(template.constructionSystemId)
    })

    const templateToNodeMap = new Map<string, string>()

    for (const template of filteredTemplates.filter((t) => !t.parentId)) {
      const node = await prisma.wbsNode.create({
        data: {
          orgId: org.orgId,
          projectId: project.id,
          code: template.code,
          name: template.name,
          category: template.category === 'ITEM' ? 'BUDGET_ITEM' : template.category === 'SUBTASK' ? 'TASK' : template.category,
          unit: template.unit || 'un',
          quantity: template.defaultQuantity ?? new Prisma.Decimal(0),
          description: template.description,
          sortOrder: template.sortOrder,
          active: true,
        },
      })
      templateToNodeMap.set(template.id, node.id)
    }

    for (const template of filteredTemplates.filter((t) => t.parentId)) {
      const parentNodeId = templateToNodeMap.get(template.parentId!)
      if (parentNodeId) {
        const node = await prisma.wbsNode.create({
          data: {
            orgId: org.orgId,
            projectId: project.id,
            parentId: parentNodeId,
            code: template.code,
            name: template.name,
            category: template.category === 'ITEM' ? 'BUDGET_ITEM' : template.category === 'SUBTASK' ? 'TASK' : template.category,
            unit: template.unit || 'un',
            quantity: template.defaultQuantity ?? new Prisma.Decimal(0),
            description: template.description,
            sortOrder: template.sortOrder,
            active: true,
          },
        })
        templateToNodeMap.set(template.id, node.id)
      }
    }

    await prisma.budgetVersion.create({
      data: {
        orgId: org.orgId,
        projectId: project.id,
        versionCode: 'V1',
        versionType: 'INITIAL',
        status: 'DRAFT',
        notes: 'Versión inicial creada desde template',
        createdByOrgMemberId: org.memberId,
      },
    })

    revalidatePath('/projects')
    return { success: true, projectId: project.id }
  } catch (error) {
    console.error('Error creating project from template:', error)
    return { success: false, error: 'Error al crear el proyecto' }
  }
}

export async function getProject(projectId: string) {
  const { org } = await getAuthContext()
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    include: {
      createdBy: { include: { user: { select: { fullName: true, email: true } } } },
    },
  })
  if (!project) return null
  if (isRestrictedToProjects(org)) {
    const allowedIds = await getVisibleProjectIds(org)
    if (allowedIds !== null && !allowedIds.includes(projectId)) return null
  }
  return project
}

function toPlainValue(v: unknown): unknown {
  if (v == null) return v
  if (typeof v === 'object' && 'toISOString' in (v as object)) return (v as Date).toISOString()
  if (typeof v === 'object' && typeof (v as { toNumber?: () => number }).toNumber === 'function') return (v as { toNumber: () => number }).toNumber()
  return v
}

export async function updateProject(projectId: string, data: UpdateProjectInput) {
  await requirePermission('PROJECTS', 'edit')
  const { org, session } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await getProject(projectId)
  if (!existing) {
    return { error: { _form: ['Project not found'] } }
  }

  const parsed = updateProjectSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const raw = data as Record<string, unknown>

  const updatePayload: Prisma.ProjectUpdateInput = {}
  const VALID_PHASES = ['PRE_CONSTRUCTION', 'CONSTRUCTION', 'CLOSEOUT', 'COMPLETE'] as const

  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name
  if (parsed.data.clientName !== undefined) updatePayload.clientName = parsed.data.clientName
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description
  if (parsed.data.location !== undefined) updatePayload.location = parsed.data.location
  if (parsed.data.m2 !== undefined) updatePayload.m2 = parsed.data.m2
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status
  // Fase: mismo criterio que status — usar parsed.data.phase primero; si no, raw.phase (por si Zod no lo incluyó)
  if (parsed.data.phase !== undefined && VALID_PHASES.includes(parsed.data.phase as (typeof VALID_PHASES)[number])) {
    updatePayload.phase = parsed.data.phase
  } else {
    const phaseFromRaw = raw.phase
    if (typeof phaseFromRaw === 'string' && VALID_PHASES.includes(phaseFromRaw as (typeof VALID_PHASES)[number])) {
      updatePayload.phase = phaseFromRaw
    }
  }
  if (parsed.data.startDate !== undefined) updatePayload.startDate = parsed.data.startDate
  if (parsed.data.plannedEndDate !== undefined) updatePayload.plannedEndDate = parsed.data.plannedEndDate
  if (parsed.data.active !== undefined) updatePayload.active = parsed.data.active

  // Al pasar a ACTIVE: fijar baseline de fecha de finalización (solo la primera vez)
  const newStatus = parsed.data.status ?? existing.status
  const effectivePlannedEnd = parsed.data.plannedEndDate ?? existing.plannedEndDate
  if (
    newStatus === 'ACTIVE' &&
    existing.status !== 'ACTIVE' &&
    existing.baselinePlannedEndDate == null &&
    effectivePlannedEnd != null
  ) {
    updatePayload.baselinePlannedEndDate =
      effectivePlannedEnd instanceof Date ? effectivePlannedEnd : new Date(effectivePlannedEnd)
  }

  const updatedFields = Object.keys(updatePayload) as (keyof typeof existing)[]
  const beforeSnapshot: Record<string, unknown> = {}
  for (const key of updatedFields) {
    const val = existing[key as keyof typeof existing]
    beforeSnapshot[key] = toPlainValue(val)
  }
  const afterSnapshot: Record<string, unknown> = {}
  for (const key of updatedFields) {
    afterSnapshot[key] = toPlainValue((updatePayload as Record<string, unknown>)[key])
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: updatePayload,
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PROJECT.UPDATED',
      entityType: 'Project',
      entityId: projectId,
      payload: { updatedFields },
    })
  })

  await createAuditLog({
    orgId: org.orgId,
    userId: session.user.id,
    action: 'UPDATE',
    entity: 'Project',
    entityId: projectId,
    projectId: projectId,
    oldValues: beforeSnapshot,
    newValues: afterSnapshot,
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/edit`)

  return { success: true, projectId }
}

export async function deleteProject(projectId: string) {
  await requirePermission('PROJECTS', 'delete')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await getProject(projectId)
  if (!existing) {
    throw new Error('Project not found')
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: { active: false },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PROJECT.DELETED',
      entityType: 'Project',
      entityId: projectId,
      payload: { projectNumber: existing.projectNumber, name: existing.name },
    })
  })

  revalidatePath('/projects')
  return redirectTo('/projects')
}
