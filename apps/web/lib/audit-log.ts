import { prisma } from '@repo/database'
import { toInputJson } from '@/lib/json-prisma'

interface CreateAuditLogParams {
  orgId: string
  userId: string
  action: string
  entity: string
  entityId: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  description?: string
  projectId?: string
  request?: Request
}

/**
 * Crear log de auditoría usando el modelo AuditLog existente.
 */
export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    let ipAddress: string | undefined
    let userAgent: string | undefined

    if (params.request) {
      ipAddress =
        params.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        params.request.headers.get('x-real-ip') ??
        undefined
      userAgent = params.request.headers.get('user-agent') ?? undefined
    }

    await prisma.auditLog.create({
      data: {
        orgId: params.orgId,
        actorUserId: params.userId,
        action: params.action,
        entityType: params.entity,
        entityId: params.entityId,
        projectId: params.projectId ?? null,
        beforeSnapshot: params.oldValues != null ? toInputJson(params.oldValues) : null,
        afterSnapshot: params.newValues != null ? toInputJson(params.newValues) : null,
        detailsJson: params.description
          ? toInputJson({ description: params.description })
          : null,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    console.error('Error creating audit log:', error)
  }
}

/**
 * Obtener logs de una entidad
 */
export async function getEntityAuditLogs(
  entity: string,
  entityId: string,
  orgId: string
) {
  return prisma.auditLog.findMany({
    where: {
      entityType: entity,
      entityId,
      orgId,
    },
    include: {
      actor: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Obtener logs recientes de la organización
 */
export async function getRecentAuditLogs(orgId: string, limit: number = 50) {
  return prisma.auditLog.findMany({
    where: { orgId },
    include: {
      actor: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
