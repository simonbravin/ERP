'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { assertProjectAccess } from '@/lib/project-permissions'
import { prisma, Prisma } from '@repo/database'
import { canEditSchedule } from '@/lib/schedule-permissions'
import { revalidatePath } from 'next/cache'
import { calculateCriticalPath } from '@/lib/schedule/critical-path'
import {
  addWorkingDays,
  countWorkingDays,
  type WorkingDayOptions,
} from '@/lib/schedule/working-days'
import {
  parseNonWorkingDatesFromJson,
  parseNonWorkingDatesFromUserInput,
  workingDayOptionsFromStrings,
} from '@/lib/schedule/schedule-non-working'
import { validateTaskDatesAgainstDependencies } from '@/lib/schedule/validate-dependencies'
import { wouldCreateCycle } from '@/lib/schedule/dependency-cycle'
import { parseMsProjectXml } from '@/lib/schedule/ms-project-xml'
import {
  parseProjectId,
  parseTaskId,
  parseDependencyId,
  parseScheduleId,
  addTaskDependencySchema,
} from '@/lib/schemas/schedule'
import { createAuditLog } from '@/lib/audit-log'
import { addDays, differenceInDays, startOfDay } from 'date-fns'
import { assertBillingWriteAllowed } from '@/lib/billing/guards'

/** Fechas plan, progreso y dependencias: cualquier versión activa del cronograma (incl. aprobada). */
function isScheduleInteractivePlanStatus(status: string): boolean {
  return (
    status === 'DRAFT' ||
    status === 'BASELINE' ||
    status === 'APPROVED'
  )
}

/**
 * Crear nuevo cronograma desde WBS.
 * Duración: cada TASK recibe 1 día inicial; las SUMMARY se recalculan después con el
 * rango de sus subtareas (min inicio hijos → max fin hijos).
 */
export async function createScheduleFromWBS(
  projectId: string,
  data: {
    name: string
    description?: string
    projectStartDate: Date
    workingDaysPerWeek: number
    hoursPerDay: number
  }
) {
  const parsed = parseProjectId(projectId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.createFromWbs')

  try {
    const access = await assertProjectAccess(parsed.projectId, org)
    if (!canEditSchedule(org, access.projectRole)) {
      return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  try {
    // Validación: proyecto debe tener presupuesto aprobado o baseline
    const approvedBudget = await prisma.budgetVersion.findFirst({
      where: {
        projectId: parsed.projectId,
        orgId: org.orgId,
        status: { in: ['BASELINE', 'APPROVED'] },
      },
    })
    if (!approvedBudget) {
      return {
        success: false,
        error:
          'El proyecto debe tener un presupuesto aprobado o baseline antes de crear el cronograma.',
      }
    }

    const wbsNodes = await prisma.wbsNode.findMany({
      where: { projectId: parsed.projectId, orgId: org.orgId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    })

    if (wbsNodes.length === 0) {
      return {
        success: false,
        error: 'El proyecto no tiene estructura WBS. Crea el presupuesto primero.',
      }
    }

    // Validación: nombre único del cronograma en el proyecto
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        projectId: parsed.projectId,
        orgId: org.orgId,
        name: data.name,
      },
    })
    if (existingSchedule) {
      return {
        success: false,
        error: 'Ya existe un cronograma con ese nombre. Usa un nombre diferente.',
      }
    }

    const schedule = await prisma.schedule.create({
      data: {
        orgId: org.orgId,
        projectId: parsed.projectId,
        name: data.name,
        description: data.description,
        status: 'DRAFT',
        projectStartDate: data.projectStartDate,
        projectEndDate: data.projectStartDate,
        workingDaysPerWeek: data.workingDaysPerWeek,
        hoursPerDay: data.hoursPerDay,
        createdByOrgMemberId: org.memberId,
      },
    })

    const projectStart = new Date(data.projectStartDate)
    const createdTasks = new Map<string, string>()

    for (const node of wbsNodes) {
      const hasChildren = wbsNodes.some((n) => n.parentId === node.id)
      const taskType = hasChildren ? 'SUMMARY' : 'TASK'
      const duration = taskType === 'TASK' ? 0 : 0
      const startDate = projectStart
      const endDate = projectStart

      const task = await prisma.scheduleTask.create({
        data: {
          scheduleId: schedule.id,
          wbsNodeId: node.id,
          taskType,
          plannedStartDate: startDate,
          plannedEndDate: endDate,
          plannedDuration: duration,
          progressPercent: new Prisma.Decimal(0),
        },
      })

      createdTasks.set(node.id, task.id)
    }

    // ROLLUP: Recalcular fechas de tareas SUMMARY basado en hijos (más profundo primero)
    const summaryNodes = wbsNodes.filter((node) =>
      wbsNodes.some((n) => n.parentId === node.id)
    )
    const sortedSummary = [...summaryNodes].sort((a, b) => {
      const aLevel = a.code.split('.').length
      const bLevel = b.code.split('.').length
      return bLevel - aLevel
    })

    for (const summaryNode of sortedSummary) {
      const childrenIds = wbsNodes
        .filter((n) => n.parentId === summaryNode.id)
        .map((n) => createdTasks.get(n.id))
        .filter((id): id is string => !!id)

      if (childrenIds.length === 0) continue

      const childTasks = await prisma.scheduleTask.findMany({
        where: { id: { in: childrenIds } },
        select: {
          plannedStartDate: true,
          plannedEndDate: true,
        },
      })

      const minStart = childTasks.reduce(
        (min, t) =>
          t.plannedStartDate < min ? t.plannedStartDate : min,
        childTasks[0]!.plannedStartDate
      )
      const maxEnd = childTasks.reduce(
        (max, t) => (t.plannedEndDate > max ? t.plannedEndDate : max),
        childTasks[0]!.plannedEndDate
      )
      const durationDays = Math.max(
        1,
        differenceInDays(maxEnd, minStart) + 1
      )

      const summaryTaskId = createdTasks.get(summaryNode.id)
      if (summaryTaskId) {
        await prisma.scheduleTask.update({
          where: { id: summaryTaskId },
          data: {
            plannedStartDate: minStart,
            plannedEndDate: maxEnd,
            plannedDuration: durationDays,
          },
        })
      }
    }

    const allTasksForEnd = await prisma.scheduleTask.findMany({
      where: { scheduleId: schedule.id },
      select: { plannedEndDate: true },
    })
    const maxTaskEnd = allTasksForEnd.reduce(
      (max, t) => (t.plannedEndDate > max ? t.plannedEndDate : max),
      projectStart
    )
    const projectEndDate = maxTaskEnd.getTime() > projectStart.getTime()
      ? maxTaskEnd
      : addDays(projectStart, 30)
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { projectEndDate },
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'CREATE',
      entity: 'Schedule',
      entityId: schedule.id,
      projectId: parsed.projectId,
      description: `Cronograma "${data.name}" creado con ${wbsNodes.length} tareas`,
    })

    revalidatePath(`/projects/${parsed.projectId}/schedule`)

    return {
      success: true,
      scheduleId: schedule.id,
      tasksCreated: wbsNodes.length,
    }
  } catch (error) {
    console.error('Error creating schedule:', error)
    return { success: false, error: 'Error al crear cronograma' }
  }
}

/**
 * Duplica un cronograma (cualquier status) en un nuevo DRAFT.
 *
 * Copia: fechas planificadas y reales, duración, tipo, % avance, notas, asignación, restricciones,
 * dependencias (FS/SS/FF/SF + lag). No copia baseline/aprobación ni float/ruta crítica (se recalcula).
 */
export async function duplicateScheduleAsDraft(
  sourceScheduleId: string,
  data: { name: string; description?: string }
) {
  const parsed = parseScheduleId(sourceScheduleId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.duplicateAsDraft')

  if (!data.name?.trim()) {
    return { success: false, error: 'El nombre es obligatorio' }
  }

  try {
    const source = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      include: { tasks: true },
    })

    if (!source) {
      return { success: false, error: 'Cronograma no encontrado' }
    }

    try {
      const access = await assertProjectAccess(source.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return {
          success: false,
          error: 'No tenés permiso para crear cronogramas en este proyecto',
        }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    const nameTaken = await prisma.schedule.findFirst({
      where: {
        projectId: source.projectId,
        orgId: org.orgId,
        name: data.name.trim(),
      },
    })
    if (nameTaken) {
      return {
        success: false,
        error: 'Ya existe un cronograma con ese nombre. Usa un nombre diferente.',
      }
    }

    const deps = await prisma.taskDependency.findMany({
      where: { scheduleId: source.id },
    })

    const newSchedule = await prisma.$transaction(async (tx) => {
      const created = await tx.schedule.create({
        data: {
          orgId: org.orgId,
          projectId: source.projectId,
          name: data.name.trim(),
          description: data.description?.trim() || source.description,
          status: 'DRAFT',
          projectStartDate: source.projectStartDate,
          projectEndDate: source.projectEndDate,
          workingDaysPerWeek: source.workingDaysPerWeek,
          hoursPerDay: source.hoursPerDay,
          nonWorkingDates:
            source.nonWorkingDates === null || source.nonWorkingDates === undefined
              ? Prisma.DbNull
              : source.nonWorkingDates,
          isBaseline: false,
          baselineDate: null,
          createdByOrgMemberId: org.memberId,
          approvedByOrgMemberId: null,
          approvedAt: null,
        },
      })

      const idMap = new Map<string, string>()

      for (const t of source.tasks) {
        const nt = await tx.scheduleTask.create({
          data: {
            scheduleId: created.id,
            wbsNodeId: t.wbsNodeId,
            taskType: t.taskType,
            plannedStartDate: t.plannedStartDate,
            plannedEndDate: t.plannedEndDate,
            plannedDuration: t.plannedDuration,
            actualStartDate: t.actualStartDate,
            actualEndDate: t.actualEndDate,
            actualDuration: t.actualDuration,
            progressPercent: t.progressPercent,
            earlyStart: null,
            earlyFinish: null,
            lateStart: null,
            lateFinish: null,
            totalFloat: null,
            freeFloat: null,
            isCritical: false,
            constraintType: t.constraintType,
            constraintDate: t.constraintDate,
            assignedTo: t.assignedTo,
            notes: t.notes,
          },
        })
        idMap.set(t.id, nt.id)
      }

      for (const d of deps) {
        const pred = idMap.get(d.predecessorId)
        const succ = idMap.get(d.successorId)
        if (!pred || !succ) continue
        await tx.taskDependency.create({
          data: {
            scheduleId: created.id,
            predecessorId: pred,
            successorId: succ,
            dependencyType: d.dependencyType,
            lagDays: d.lagDays,
          },
        })
      }

      return created
    })

    await recalculateCriticalPath(newSchedule.id)

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'CREATE',
      entity: 'Schedule',
      entityId: newSchedule.id,
      projectId: source.projectId,
      description: `Cronograma duplicado como borrador desde "${source.name}" → "${data.name.trim()}"`,
    })

    revalidatePath(`/projects/${source.projectId}/schedule`)

    return {
      success: true,
      scheduleId: newSchedule.id,
      tasksCreated: source.tasks.length,
    }
  } catch (error) {
    console.error('Error duplicating schedule:', error)
    return { success: false, error: 'Error al duplicar el cronograma' }
  }
}

/**
 * Actualizar fechas/duración de una tarea.
 * Aquí se setea la duración de cada tarea (plannedStartDate, plannedEndDate, plannedDuration).
 * Las tareas SUMMARY se calculan automáticamente desde sus subtareas al crear el cronograma;
 * las TASK/MILESTONE se editan con esta función (o desde una futura UI de edición en el Gantt).
 */
export async function updateTaskDates(
  taskId: string,
  data: {
    plannedStartDate?: Date
    plannedEndDate?: Date
    plannedDuration?: number
    notes?: string | null
    /** Recurso / responsable (texto libre; v1 SCH-D3). */
    assignedTo?: string | null
  }
) {
  const parsedTask = parseTaskId(taskId)
  if (parsedTask.success === false) return { success: false, error: parsedTask.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.updateTaskDates')

  try {
    const task = await prisma.scheduleTask.findFirst({
      where: { id: parsedTask.taskId },
      include: {
        schedule: {
          select: {
            id: true,
            status: true,
            projectId: true,
            orgId: true,
            workingDaysPerWeek: true,
            nonWorkingDates: true,
          },
        },
        wbsNode: {
          select: { id: true, code: true, parentId: true },
        },
      },
    })

    if (!task || task.schedule.orgId !== org.orgId) {
      return { success: false, error: 'Task not found' }
    }
    try {
      const access = await assertProjectAccess(task.schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return { success: false, error: 'No tenés permiso para editar esta tarea' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (!isScheduleInteractivePlanStatus(task.schedule.status)) {
      return {
        success: false,
        error:
          'Solo se puede editar el plan en borrador (DRAFT) o en versión baseline del proyecto',
      }
    }

    const calendarOptions = workingDayOptionsFromStrings(
      parseNonWorkingDatesFromJson(task.schedule.nonWorkingDates)
    )

    if (task.taskType === 'SUMMARY') {
      return {
        success: false,
        error: 'No se pueden editar fechas de tareas SUMMARY directamente',
      }
    }

    const updateData: {
      plannedStartDate?: Date
      plannedEndDate?: Date
      plannedDuration?: number
      notes?: string | null
      assignedTo?: string | null
    } = {}
    if (data.plannedStartDate != null) updateData.plannedStartDate = data.plannedStartDate
    if (data.plannedEndDate != null) updateData.plannedEndDate = data.plannedEndDate
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.assignedTo !== undefined) {
      const trimmed = data.assignedTo?.trim()
      updateData.assignedTo = trimmed && trimmed.length > 0 ? trimmed : null
    }
    if (data.plannedDuration != null) {
      updateData.plannedDuration = data.plannedDuration
      // Si solo envían duración, recalcular fin = inicio + duración (días laborables)
      if (data.plannedEndDate == null) {
        const start = new Date(updateData.plannedStartDate ?? task.plannedStartDate)
        updateData.plannedEndDate = addWorkingDays(
          start,
          data.plannedDuration,
          task.schedule.workingDaysPerWeek,
          calendarOptions
        )
      }
    }

    const newStart = new Date(updateData.plannedStartDate ?? task.plannedStartDate)
    const newEnd = new Date(updateData.plannedEndDate ?? task.plannedEndDate)

    const taskWithDeps = await prisma.scheduleTask.findFirst({
      where: { id: parsedTask.taskId },
      include: {
        predecessors: {
          include: {
            predecessor: {
              select: {
                plannedStartDate: true,
                plannedEndDate: true,
                wbsNode: { select: { code: true } },
              },
            },
          },
        },
        successors: {
          include: {
            successor: {
              select: {
                plannedStartDate: true,
                plannedEndDate: true,
                wbsNode: { select: { code: true } },
              },
            },
          },
        },
      },
    })

    if (taskWithDeps) {
      const predecessors = taskWithDeps.predecessors.map((d) => ({
        plannedStartDate: d.predecessor.plannedStartDate,
        plannedEndDate: d.predecessor.plannedEndDate,
        dependencyType: d.dependencyType as 'FS' | 'SS' | 'FF' | 'SF',
        lagDays: d.lagDays,
        code: d.predecessor.wbsNode?.code,
      }))
      const successors = taskWithDeps.successors.map((d) => ({
        plannedStartDate: d.successor.plannedStartDate,
        plannedEndDate: d.successor.plannedEndDate,
        dependencyType: d.dependencyType as 'FS' | 'SS' | 'FF' | 'SF',
        lagDays: d.lagDays,
        code: d.successor.wbsNode?.code,
      }))
      const validation = validateTaskDatesAgainstDependencies(
        newStart,
        newEnd,
        predecessors,
        successors,
        task.schedule.workingDaysPerWeek,
        calendarOptions
      )
      if (validation.valid === false) {
        return { success: false, error: validation.message }
      }
    }

    const beforeSnapshot = {
      plannedStartDate: task.plannedStartDate,
      plannedEndDate: task.plannedEndDate,
      plannedDuration: task.plannedDuration,
      notes: task.notes ?? null,
      assignedTo: task.assignedTo ?? null,
    }

    await prisma.scheduleTask.update({
      where: { id: parsedTask.taskId },
      data: updateData,
    })

    if (task.wbsNode.parentId) {
      await recalculateParentSummaryTasks(
        task.schedule.id,
        task.wbsNode.parentId,
        task.schedule.workingDaysPerWeek,
        calendarOptions
      )
    }

    await recalculateCriticalPath(task.schedule.id)

    const afterTask = await prisma.scheduleTask.findUnique({
      where: { id: parsedTask.taskId },
      select: {
        plannedStartDate: true,
        plannedEndDate: true,
        plannedDuration: true,
        notes: true,
        assignedTo: true,
      },
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE_TASK_DATES',
      entity: 'ScheduleTask',
      entityId: parsedTask.taskId,
      projectId: task.schedule.projectId,
      oldValues: beforeSnapshot,
      newValues: afterTask ?? undefined,
      description: `Plan de tarea actualizado: ${task.wbsNode.code}`,
    })

    revalidatePath(`/projects/${task.schedule.projectId}/schedule`)

    return { success: true }
  } catch (error) {
    console.error('Error updating task dates:', error)
    return { success: false, error: 'Error al actualizar fechas' }
  }
}

/**
 * Agregar dependencia entre tareas
 */
export async function addTaskDependency(data: {
  scheduleId: string
  predecessorId: string
  successorId: string
  dependencyType: 'FS' | 'SS' | 'FF' | 'SF'
  lagDays?: number
}) {
  const parsed = addTaskDependencySchema.safeParse(data)
  if (parsed.success === false) {
    const msg = parsed.error.flatten().formErrors[0]
    return { success: false, error: msg ?? 'Datos inválidos' }
  }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.addTaskDependency')

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.data.scheduleId, orgId: org.orgId },
    })

    if (!schedule) {
      return { success: false, error: 'Schedule not found' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (!isScheduleInteractivePlanStatus(schedule.status)) {
      return {
        success: false,
        error:
          'Solo se puede editar dependencias en borrador (DRAFT) o en versión baseline',
      }
    }

    const createsCycle = await checkForCycle(
      parsed.data.scheduleId,
      parsed.data.predecessorId,
      parsed.data.successorId
    )

    if (createsCycle) {
      return {
        success: false,
        error: 'Esta dependencia crearía un ciclo. No es permitido.',
      }
    }

    const [predTask, succTask] = await Promise.all([
      prisma.scheduleTask.findFirst({
        where: {
          id: parsed.data.predecessorId,
          scheduleId: parsed.data.scheduleId,
        },
        include: { wbsNode: { select: { code: true } } },
      }),
      prisma.scheduleTask.findFirst({
        where: {
          id: parsed.data.successorId,
          scheduleId: parsed.data.scheduleId,
        },
        include: { wbsNode: { select: { code: true } } },
      }),
    ])
    const predCode = predTask?.wbsNode?.code ?? '?'
    const succCode = succTask?.wbsNode?.code ?? '?'

    const dependency = await prisma.taskDependency.create({
      data: {
        scheduleId: parsed.data.scheduleId,
        predecessorId: parsed.data.predecessorId,
        successorId: parsed.data.successorId,
        dependencyType: parsed.data.dependencyType,
        lagDays: parsed.data.lagDays ?? 0,
      },
    })

    await recalculateCriticalPath(parsed.data.scheduleId)

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'CREATE',
      entity: 'TaskDependency',
      entityId: dependency.id,
      projectId: schedule.projectId,
      newValues: {
        predecessorCode: predCode,
        successorCode: succCode,
        dependencyType: parsed.data.dependencyType,
        lagDays: parsed.data.lagDays ?? 0,
      },
      description: `Dependencia ${parsed.data.dependencyType}: ${predCode} → ${succCode}`,
    })

    revalidatePath(`/projects/${schedule.projectId}/schedule`)

    return { success: true, dependencyId: dependency.id }
  } catch (error) {
    console.error('Error adding dependency:', error)
    return { success: false, error: 'Error al agregar dependencia' }
  }
}

/**
 * Eliminar dependencia
 */
export async function removeTaskDependency(dependencyId: string) {
  const parsed = parseDependencyId(dependencyId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.removeTaskDependency')

  try {
    const dependency = await prisma.taskDependency.findFirst({
      where: { id: parsed.dependencyId },
      include: {
        schedule: { select: { id: true, orgId: true, projectId: true, status: true } },
        predecessor: { include: { wbsNode: { select: { code: true, name: true } } } },
        successor: { include: { wbsNode: { select: { code: true, name: true } } } },
      },
    })

    if (!dependency || dependency.schedule.orgId !== org.orgId) {
      return { success: false, error: 'Dependency not found' }
    }
    try {
      const access = await assertProjectAccess(dependency.schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (!isScheduleInteractivePlanStatus(dependency.schedule.status)) {
      return {
        success: false,
        error:
          'Solo se puede editar dependencias en borrador (DRAFT) o en versión baseline',
      }
    }

    await prisma.taskDependency.delete({ where: { id: parsed.dependencyId } })

    await recalculateCriticalPath(dependency.schedule.id)

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'DELETE',
      entity: 'TaskDependency',
      entityId: parsed.dependencyId,
      projectId: dependency.schedule.projectId,
      oldValues: {
        scheduleId: dependency.schedule.id,
        dependencyType: dependency.dependencyType,
        lagDays: dependency.lagDays,
        predecessorCode: dependency.predecessor.wbsNode.code,
        successorCode: dependency.successor.wbsNode.code,
      },
      description: `Dependencia eliminada: ${dependency.predecessor.wbsNode.code} → ${dependency.successor.wbsNode.code}`,
    })

    revalidatePath(`/projects/${dependency.schedule.projectId}/schedule`)

    return { success: true }
  } catch (error) {
    console.error('Error removing dependency:', error)
    return { success: false, error: 'Error al eliminar dependencia' }
  }
}

/**
 * Actualizar progreso de tarea (misma regla de estado que fechas plan y dependencias: DRAFT, BASELINE, APPROVED).
 */
export async function updateTaskProgress(
  taskId: string,
  data: {
    progressPercent: number
    actualStartDate?: Date
    actualEndDate?: Date
  }
) {
  const parsedTask = parseTaskId(taskId)
  if (parsedTask.success === false) return { success: false, error: parsedTask.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.updateTaskProgress')

  try {
    const task = await prisma.scheduleTask.findFirst({
      where: { id: parsedTask.taskId },
      include: {
        schedule: { select: { orgId: true, projectId: true, status: true } },
        wbsNode: { select: { code: true, name: true } },
      },
    })

    if (!task || task.schedule.orgId !== org.orgId) {
      return { success: false, error: 'Task not found' }
    }
    try {
      const access = await assertProjectAccess(task.schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return { success: false, error: 'No tenés permiso para editar esta tarea' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (!isScheduleInteractivePlanStatus(task.schedule.status)) {
      return {
        success: false,
        error:
          'Solo se puede editar el progreso en borrador (DRAFT) o en versión baseline',
      }
    }

    if (data.progressPercent < 0 || data.progressPercent > 100) {
      return { success: false, error: 'El progreso debe estar entre 0 y 100' }
    }

    const updateData: {
      progressPercent: Prisma.Decimal
      actualStartDate?: Date
      actualEndDate?: Date
      actualDuration?: number
    } = {
      progressPercent: new Prisma.Decimal(data.progressPercent),
    }
    if (data.actualStartDate != null) updateData.actualStartDate = data.actualStartDate
    if (data.actualEndDate != null) updateData.actualEndDate = data.actualEndDate
    if (data.actualStartDate != null && data.actualEndDate != null) {
      updateData.actualDuration = Math.ceil(
        (data.actualEndDate.getTime() - data.actualStartDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    }

    const beforeProgress = Number(task.progressPercent)
    const beforeSnapshot = {
      progressPercent: beforeProgress,
      actualStartDate: task.actualStartDate?.toISOString() ?? null,
      actualEndDate: task.actualEndDate?.toISOString() ?? null,
    }

    await prisma.scheduleTask.update({
      where: { id: parsedTask.taskId },
      data: updateData,
    })

    const afterRow = await prisma.scheduleTask.findUnique({
      where: { id: parsedTask.taskId },
      select: {
        progressPercent: true,
        actualStartDate: true,
        actualEndDate: true,
      },
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE_TASK_PROGRESS',
      entity: 'ScheduleTask',
      entityId: parsedTask.taskId,
      projectId: task.schedule.projectId,
      oldValues: beforeSnapshot,
      newValues: afterRow
        ? {
            progressPercent: Number(afterRow.progressPercent),
            actualStartDate: afterRow.actualStartDate?.toISOString() ?? null,
            actualEndDate: afterRow.actualEndDate?.toISOString() ?? null,
          }
        : { progressPercent: data.progressPercent },
      description: `Progreso ${task.wbsNode.code}: ${beforeProgress}% → ${data.progressPercent}%`,
    })

    revalidatePath(`/projects/${task.schedule.projectId}/schedule`)

    return { success: true }
  } catch (error) {
    console.error('Error updating task progress:', error)
    return { success: false, error: 'Error al actualizar progreso' }
  }
}

/**
 * Historial de cambios del cronograma (auditoría en `audit_logs`).
 */
export async function getScheduleAuditLogs(scheduleId: string) {
  const parsed = parseScheduleId(scheduleId)
  if (parsed.success === false) {
    return { success: false as const, error: parsed.error, logs: [] }
  }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized', logs: [] }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false as const, error: 'Unauthorized', logs: [] }

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      select: { id: true, projectId: true },
    })
    if (!schedule) {
      return { success: false as const, error: 'Schedule not found', logs: [] }
    }
    await assertProjectAccess(schedule.projectId, org)

    const [taskIds, depIds] = await Promise.all([
      prisma.scheduleTask.findMany({
        where: { scheduleId: schedule.id },
        select: { id: true },
      }),
      prisma.taskDependency.findMany({
        where: { scheduleId: schedule.id },
        select: { id: true },
      }),
    ])

    const logs = await prisma.auditLog.findMany({
      where: {
        orgId: org.orgId,
        OR: [
          { entityType: 'Schedule', entityId: schedule.id },
          {
            entityType: 'ScheduleTask',
            entityId: { in: taskIds.map((t) => t.id) },
          },
          {
            entityType: 'TaskDependency',
            entityId: { in: depIds.map((d) => d.id) },
          },
        ],
      },
      include: {
        actor: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return { success: true as const, logs }
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : 'Error',
      logs: [],
    }
  }
}

/**
 * Recalcular ruta crítica de un cronograma
 */
async function recalculateCriticalPath(scheduleId: string) {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        tasks: {
          include: {
            predecessors: true,
            successors: true,
          },
        },
      },
    })

    if (!schedule || schedule.tasks.length === 0) return

    const calendarOptions = workingDayOptionsFromStrings(
      parseNonWorkingDatesFromJson(schedule.nonWorkingDates)
    )

    const taskNodes = schedule.tasks.map((task) => ({
      id: task.id,
      duration: task.plannedDuration,
      predecessors: task.predecessors.map((dep) => ({
        id: dep.predecessorId,
        type: dep.dependencyType as 'FS' | 'SS' | 'FF' | 'SF',
        lag: dep.lagDays,
      })),
      successors: task.successors.map((dep) => ({
        id: dep.successorId,
        type: dep.dependencyType as 'FS' | 'SS' | 'FF' | 'SF',
        lag: dep.lagDays,
      })),
    }))

    const calculated = calculateCriticalPath(
      taskNodes,
      new Date(schedule.projectStartDate),
      schedule.workingDaysPerWeek,
      calendarOptions
    )

    for (const calc of calculated) {
      await prisma.scheduleTask.update({
        where: { id: calc.id },
        data: {
          earlyStart: calc.earlyStart,
          earlyFinish: calc.earlyFinish,
          lateStart: calc.lateStart,
          lateFinish: calc.lateFinish,
          totalFloat: calc.totalFloat,
          freeFloat: calc.freeFloat,
          isCritical: calc.isCritical,
        },
      })
    }

    const maxFinish = calculated.reduce(
      (max, task) => (task.earlyFinish > max ? task.earlyFinish : max),
      new Date(schedule.projectStartDate)
    )

    const currentEnd = new Date(schedule.projectEndDate)
    const nextEnd =
      maxFinish.getTime() > currentEnd.getTime() ? maxFinish : currentEnd

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { projectEndDate: nextEnd },
    })
  } catch (error) {
    console.error('Error recalculating critical path:', error)
  }
}

/**
 * Recalcular fechas de tareas SUMMARY basado en hijos (min inicio, max fin, duración en días laborables).
 */
async function recalculateParentSummaryTasks(
  scheduleId: string,
  parentWbsId: string,
  workingDaysPerWeek: number,
  calendarOptions?: WorkingDayOptions
) {
  try {
    const parentTask = await prisma.scheduleTask.findFirst({
      where: {
        scheduleId,
        wbsNodeId: parentWbsId,
      },
      include: {
        wbsNode: {
          select: { id: true, parentId: true },
        },
      },
    })

    if (!parentTask || parentTask.taskType !== 'SUMMARY') return

    const childWbsNodes = await prisma.wbsNode.findMany({
      where: { parentId: parentWbsId },
      select: { id: true },
    })

    const childWbsIds = childWbsNodes.map((n) => n.id)

    const childTasks = await prisma.scheduleTask.findMany({
      where: {
        scheduleId,
        wbsNodeId: { in: childWbsIds },
      },
      select: {
        plannedStartDate: true,
        plannedEndDate: true,
      },
    })

    if (childTasks.length === 0) return

    const minStart = childTasks.reduce(
      (min, task) =>
        task.plannedStartDate < min ? task.plannedStartDate : min,
      childTasks[0].plannedStartDate
    )

    const maxEnd = childTasks.reduce(
      (max, task) =>
        task.plannedEndDate > max ? task.plannedEndDate : max,
      childTasks[0].plannedEndDate
    )

    const duration = countWorkingDays(
      minStart,
      maxEnd,
      workingDaysPerWeek,
      calendarOptions
    )

    await prisma.scheduleTask.update({
      where: { id: parentTask.id },
      data: {
        plannedStartDate: minStart,
        plannedEndDate: maxEnd,
        plannedDuration: duration,
      },
    })

    if (parentTask.wbsNode.parentId) {
      await recalculateParentSummaryTasks(
        scheduleId,
        parentTask.wbsNode.parentId,
        workingDaysPerWeek,
        calendarOptions
      )
    }
  } catch (error) {
    console.error('Error recalculating parent summary:', error)
  }
}

async function rollupAllSummaryTasksForSchedule(
  scheduleId: string,
  workingDaysPerWeek: number,
  calendarOptions?: WorkingDayOptions
) {
  const summaries = await prisma.scheduleTask.findMany({
    where: { scheduleId, taskType: 'SUMMARY' },
    include: { wbsNode: { select: { code: true } } },
  })
  const sorted = [...summaries].sort((a, b) => {
    const da = a.wbsNode.code.split('.').length
    const db = b.wbsNode.code.split('.').length
    return db - da
  })
  for (const s of sorted) {
    await recalculateParentSummaryTasks(
      scheduleId,
      s.wbsNodeId,
      workingDaysPerWeek,
      calendarOptions
    )
  }
}

/**
 * Detectar si agregar predecessorId -> successorId crearía un ciclo.
 * Usa wouldCreateCycle (lógica pura testeable) con las dependencias del schedule.
 */
async function checkForCycle(
  scheduleId: string,
  predecessorId: string,
  successorId: string
): Promise<boolean> {
  const deps = await prisma.taskDependency.findMany({
    where: { scheduleId },
    select: { predecessorId: true, successorId: true },
  })
  return wouldCreateCycle(deps, predecessorId, successorId)
}

/**
 * Establecer cronograma como BASELINE
 */
export async function setScheduleAsBaseline(scheduleId: string) {
  const parsed = parseScheduleId(scheduleId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'ADMIN')
  await assertBillingWriteAllowed(org.orgId, 'schedule.setBaseline')

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      include: { project: { select: { id: true, name: true, startDate: true } } },
    })

    if (!schedule) {
      return { success: false, error: 'Schedule not found' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    await prisma.schedule.updateMany({
      where: {
        projectId: schedule.projectId,
        isBaseline: true,
      },
      data: { isBaseline: false },
    })

    await prisma.schedule.update({
      where: { id: parsed.scheduleId },
      data: {
        status: 'BASELINE',
        isBaseline: true,
        baselineDate: new Date(),
      },
    })

    const projectUpdate: {
      plannedEndDate: Date
      baselinePlannedEndDate: Date
      startDate?: Date
    } = {
      plannedEndDate: schedule.projectEndDate,
      baselinePlannedEndDate: schedule.projectEndDate,
    }
    if (!schedule.project.startDate) {
      projectUpdate.startDate = schedule.projectStartDate
    }
    await prisma.project.update({
      where: { id: schedule.projectId },
      data: projectUpdate,
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Schedule',
      entityId: parsed.scheduleId,
      projectId: schedule.projectId,
      oldValues: {
        status: schedule.status,
        isBaseline: schedule.isBaseline,
      },
      newValues: { status: 'BASELINE', isBaseline: true },
      description: `Cronograma "${schedule.name}" establecido como BASELINE en proyecto "${schedule.project.name}"`,
    })

    revalidatePath(`/projects/${schedule.projectId}/schedule`)
    revalidatePath(`/projects/${schedule.projectId}`)

    return { success: true }
  } catch (error) {
    console.error('Error setting baseline:', error)
    return { success: false, error: 'Error al establecer baseline' }
  }
}

/**
 * Aprobar cronograma: setea approvedBy, approvedAt y status APPROVED.
 * Solo ADMIN/OWNER. Puede aprobar desde DRAFT o BASELINE.
 */
export async function approveSchedule(scheduleId: string) {
  const parsed = parseScheduleId(scheduleId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'ADMIN')
  await assertBillingWriteAllowed(org.orgId, 'schedule.approve')

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      include: { project: { select: { id: true, name: true } } },
    })

    if (!schedule) {
      return { success: false, error: 'Schedule not found' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return { success: false, error: 'No tenés permiso para aprobar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (schedule.status === 'APPROVED') {
      return { success: false, error: 'Este cronograma ya está aprobado.' }
    }

    const approvedAt = new Date()
    await prisma.schedule.update({
      where: { id: parsed.scheduleId },
      data: {
        status: 'APPROVED',
        approvedByOrgMemberId: org.memberId,
        approvedAt,
      },
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Schedule',
      entityId: parsed.scheduleId,
      projectId: schedule.projectId,
      oldValues: { status: schedule.status },
      newValues: { status: 'APPROVED', approvedAt: approvedAt.toISOString() },
      description: `Cronograma "${schedule.name}" aprobado en proyecto "${schedule.project.name}"`,
    })

    revalidatePath(`/projects/${schedule.projectId}/schedule`)
    revalidatePath(`/projects/${schedule.projectId}`)

    return { success: true }
  } catch (error) {
    console.error('Error approving schedule:', error)
    return { success: false, error: 'Error al aprobar cronograma' }
  }
}

/**
 * Guardar feriados / días no laborables (DRAFT o baseline editable del proyecto).
 * Recalcula ruta crítica y fechas de resumen para reflejar el calendario.
 */
export async function updateScheduleNonWorkingDates(scheduleId: string, text: string) {
  const parsed = parseScheduleId(scheduleId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.updateNonWorkingDates')

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      select: { id: true, projectId: true, status: true, name: true, nonWorkingDates: true },
    })

    if (!schedule) {
      return { success: false, error: 'Cronograma no encontrado' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return {
          success: false,
          error: 'No tenés permiso para editar el cronograma de este proyecto',
        }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (!isScheduleInteractivePlanStatus(schedule.status)) {
      return {
        success: false,
        error:
          'Solo se pueden editar excepciones de calendario en borrador (DRAFT) o en versión baseline del proyecto.',
      }
    }

    const previousDates = parseNonWorkingDatesFromJson(schedule.nonWorkingDates)
    const dates = parseNonWorkingDatesFromUserInput(text)

    await prisma.schedule.update({
      where: { id: parsed.scheduleId },
      data: {
        nonWorkingDates: dates.length > 0 ? dates : Prisma.DbNull,
      },
    })

    await recalculateCriticalPath(parsed.scheduleId)

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Schedule',
      entityId: parsed.scheduleId,
      projectId: schedule.projectId,
      oldValues: { nonWorkingDates: previousDates },
      newValues: { nonWorkingDates: dates, count: dates.length },
      description: `Calendario (no laborables) actualizado en "${schedule.name}" (${dates.length} fechas)`,
    })

    revalidatePath(`/projects/${schedule.projectId}/schedule`)

    return { success: true, count: dates.length }
  } catch (error) {
    console.error('Error updating schedule non-working dates:', error)
    return { success: false, error: 'Error al guardar el calendario' }
  }
}

export type UpdateScheduleProjectWindowResult =
  | { success: true }
  | {
      success: false
      error: string
      messageKey?: 'projectStartAfterTasksError' | 'projectEndBeforeTasksError'
    }

/**
 * Actualizar fechas de inicio y fin del proyecto del cronograma (DRAFT o baseline editable).
 * El inicio no puede ser posterior al comienzo de la tarea más temprana;
 * el fin no puede ser anterior al fin de la tarea más tardía.
 */
export async function updateScheduleProjectWindow(
  scheduleId: string,
  data: { projectStartDate: Date; projectEndDate: Date }
): Promise<UpdateScheduleProjectWindowResult> {
  const parsed = parseScheduleId(scheduleId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.updateTaskDates')

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      select: {
        id: true,
        projectId: true,
        status: true,
        name: true,
        projectStartDate: true,
        projectEndDate: true,
      },
    })

    if (!schedule) {
      return { success: false, error: 'Cronograma no encontrado' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return {
          success: false,
          error: 'No tenés permiso para editar el cronograma de este proyecto',
        }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (!isScheduleInteractivePlanStatus(schedule.status)) {
      return {
        success: false,
        error:
          'Solo se pueden editar las fechas del proyecto en borrador (DRAFT) o en versión baseline.',
      }
    }

    const start = startOfDay(data.projectStartDate)
    const end = startOfDay(data.projectEndDate)
    if (start.getTime() > end.getTime()) {
      return {
        success: false,
        error: 'La fecha de fin debe ser posterior o igual a la de inicio.',
      }
    }

    const tasks = await prisma.scheduleTask.findMany({
      where: { scheduleId: parsed.scheduleId },
      select: { plannedStartDate: true, plannedEndDate: true },
    })

    if (tasks.length > 0) {
      let minPlanned = tasks[0].plannedStartDate
      let maxPlanned = tasks[0].plannedEndDate
      for (const t of tasks) {
        if (t.plannedStartDate < minPlanned) minPlanned = t.plannedStartDate
        if (t.plannedEndDate > maxPlanned) maxPlanned = t.plannedEndDate
      }
      const minD = startOfDay(minPlanned)
      const maxD = startOfDay(maxPlanned)
      if (minD.getTime() < start.getTime()) {
        return {
          success: false,
          error: 'La fecha de inicio del proyecto es posterior al inicio de alguna tarea.',
          messageKey: 'projectStartAfterTasksError',
        }
      }
      if (maxD.getTime() > end.getTime()) {
        return {
          success: false,
          error: 'La fecha de fin del proyecto es anterior al fin de alguna tarea.',
          messageKey: 'projectEndBeforeTasksError',
        }
      }
    }

    await prisma.schedule.update({
      where: { id: parsed.scheduleId },
      data: {
        projectStartDate: start,
        projectEndDate: end,
      },
    })

    await recalculateCriticalPath(parsed.scheduleId)

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Schedule',
      entityId: parsed.scheduleId,
      projectId: schedule.projectId,
      oldValues: {
        projectStartDate: schedule.projectStartDate.toISOString(),
        projectEndDate: schedule.projectEndDate.toISOString(),
      },
      newValues: {
        projectStartDate: start.toISOString(),
        projectEndDate: end.toISOString(),
      },
      description: `Ventana del proyecto actualizada en "${schedule.name}"`,
    })

    revalidatePath(`/projects/${schedule.projectId}/schedule`)

    return { success: true }
  } catch (error) {
    console.error('Error updating schedule project window:', error)
    return { success: false, error: 'Error al actualizar las fechas del proyecto' }
  }
}

/**
 * Importar tareas y dependencias desde XML de MS Project (MSPDI), solo en DRAFT.
 * Empareja por `OutlineNumber` del XML con el código WBS de cada tarea del cronograma.
 * Reemplaza todas las dependencias del cronograma por las del archivo (omite enlaces que generarían ciclo).
 */
export async function importScheduleFromMsProjectXml(scheduleId: string, xml: string) {
  const parsed = parseScheduleId(scheduleId)
  if (parsed.success === false) return { success: false, error: parsed.error }

  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')
  await assertBillingWriteAllowed(org.orgId, 'schedule.importMsProjectXml')

  if (xml.length > 6_000_000) {
    return { success: false, error: 'El archivo XML es demasiado grande.' }
  }

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      include: {
        tasks: {
          include: {
            wbsNode: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ wbsNode: { code: 'asc' } }],
        },
      },
    })

    if (!schedule) {
      return { success: false, error: 'Cronograma no encontrado' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditSchedule(org, access.projectRole)) {
        return {
          success: false,
          error: 'No tenés permiso para editar el cronograma de este proyecto',
        }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (schedule.status !== 'DRAFT') {
      return {
        success: false,
        error: 'Solo se puede importar XML en un cronograma en borrador (DRAFT).',
      }
    }

    const hoursPerDay = Number(schedule.hoursPerDay) || 8
    let parsedXml: ReturnType<typeof parseMsProjectXml>
    try {
      parsedXml = parseMsProjectXml(xml, hoursPerDay)
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'INVALID_XML_NO_PROJECT') {
        return {
          success: false,
          error: 'El XML no contiene un elemento Project válido (formato MS Project).',
        }
      }
      return { success: false, error: 'No se pudo leer el XML.' }
    }

    if (parsedXml.tasks.length === 0) {
      return { success: false, error: 'No se encontraron tareas en el XML.' }
    }

    const calendarOptions = workingDayOptionsFromStrings(
      parseNonWorkingDatesFromJson(schedule.nonWorkingDates)
    )
    const workingDaysPerWeek = schedule.workingDaysPerWeek

    const outlineToTask = new Map<string, (typeof schedule.tasks)[number]>()
    for (const t of schedule.tasks) {
      outlineToTask.set(t.wbsNode.code.trim(), t)
    }

    const uidToTaskId = new Map<number, string>()
    for (const row of parsedXml.tasks) {
      const ours = outlineToTask.get(row.outlineNumber.trim())
      if (ours) uidToTaskId.set(row.uid, ours.id)
    }

    const updates: Array<{
      id: string
      start: Date
      end: Date
      duration: number
    }> = []

    for (const row of parsedXml.tasks) {
      if (row.isSummary) continue
      const ours = outlineToTask.get(row.outlineNumber.trim())
      if (!ours || ours.taskType === 'SUMMARY') continue

      let start = row.start ? new Date(row.start) : null
      let finish = row.finish ? new Date(row.finish) : null
      if (row.isMilestone) {
        if (start && !finish) finish = new Date(start)
        if (finish && !start) start = new Date(finish)
      }
      if (!start || !finish) continue

      const duration =
        ours.taskType === 'MILESTONE'
          ? 0
          : Math.max(
              1,
              countWorkingDays(
                start,
                finish,
                workingDaysPerWeek,
                calendarOptions
              )
            )

      updates.push({ id: ours.id, start, end: finish, duration })
    }

    const depMap = new Map<
      string,
      { pred: string; succ: string; type: string; lag: number }
    >()
    for (const row of parsedXml.tasks) {
      const succId = uidToTaskId.get(row.uid)
      if (!succId) continue
      for (const p of row.predecessors) {
        const predId = uidToTaskId.get(p.predecessorUid)
        if (!predId || predId === succId) continue
        const key = `${predId}\0${succId}`
        if (!depMap.has(key)) {
          depMap.set(key, {
            pred: predId,
            succ: succId,
            type: p.type,
            lag: Math.round(p.lagDays),
          })
        }
      }
    }
    const depList = Array.from(depMap.values())

    const previousDependencyCount = await prisma.taskDependency.count({
      where: { scheduleId: parsed.scheduleId },
    })
    const previousXmlMappedTaskCount = uidToTaskId.size

    const { createdDeps, skippedDeps } = await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.scheduleTask.update({
          where: { id: u.id },
          data: {
            plannedStartDate: u.start,
            plannedEndDate: u.end,
            plannedDuration: u.duration,
          },
        })
      }
      await tx.taskDependency.deleteMany({
        where: { scheduleId: parsed.scheduleId },
      })

      const created: Array<{ predecessorId: string; successorId: string }> = []
      let createdDeps = 0
      let skippedDeps = 0
      for (const d of depList) {
        if (wouldCreateCycle(created, d.pred, d.succ)) {
          skippedDeps++
          continue
        }
        await tx.taskDependency.create({
          data: {
            scheduleId: parsed.scheduleId,
            predecessorId: d.pred,
            successorId: d.succ,
            dependencyType: d.type,
            lagDays: d.lag,
          },
        })
        created.push({ predecessorId: d.pred, successorId: d.succ })
        createdDeps++
      }
      return { createdDeps, skippedDeps }
    })

    await rollupAllSummaryTasksForSchedule(
      parsed.scheduleId,
      workingDaysPerWeek,
      calendarOptions
    )
    await recalculateCriticalPath(parsed.scheduleId)

    const dependenciesAfterCount = await prisma.taskDependency.count({
      where: { scheduleId: parsed.scheduleId },
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'IMPORT_MS_PROJECT_XML',
      entity: 'Schedule',
      entityId: parsed.scheduleId,
      projectId: schedule.projectId,
      oldValues: {
        scheduleName: schedule.name,
        taskCount: schedule.tasks.length,
        dependencyCount: previousDependencyCount,
        xmlSizeBytes: xml.length,
        xmlTaskRowCount: parsedXml.tasks.length,
        xmlMappedTaskCount: previousXmlMappedTaskCount,
      },
      newValues: {
        tasksUpdated: updates.length,
        dependenciesCreated: createdDeps,
        dependenciesSkippedCycle: skippedDeps,
        dependencyCountAfter: dependenciesAfterCount,
      },
      description: `Importación MS Project XML en "${schedule.name}": ${updates.length} tareas actualizadas, ${createdDeps} dependencias (${skippedDeps} omitidas por ciclo); antes ${previousDependencyCount} deps, después ${dependenciesAfterCount}`,
    })

    revalidatePath(`/projects/${schedule.projectId}/schedule`)

    return {
      success: true,
      updatedTasks: updates.length,
      createdDependencies: createdDeps,
      skippedDependencies: skippedDeps,
    }
  } catch (error) {
    console.error('Error importing MS Project XML:', error)
    return { success: false, error: 'Error al importar el XML' }
  }
}

/**
 * Obtener cronograma completo para vista (con serialización de fechas para hidratación)
 */
export async function getScheduleForView(scheduleId: string) {
  const parsed = parseScheduleId(scheduleId)
  if (parsed.success === false) return null

  const session = await getSession()
  if (!session?.user?.id) return null

  const org = await getOrgContext(session.user.id)
  if (!org) return null

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: parsed.scheduleId, orgId: org.orgId },
      include: {
        project: {
          select: { id: true, name: true, projectNumber: true },
        },
        tasks: {
          include: {
            wbsNode: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                parentId: true,
              },
            },
            predecessors: {
              include: {
                predecessor: {
                  select: {
                    id: true,
                    wbsNode: {
                      select: { code: true, name: true },
                    },
                  },
                },
              },
            },
            successors: {
              include: {
                successor: {
                  select: {
                    id: true,
                    wbsNode: {
                      select: { code: true, name: true },
                    },
                  },
                },
              },
            },
          },
          // Order by WBS code so hierarchy is correct (1, 1.1, 1.1.1, 2, 2.1, 2.1.1, …).
          // sortOrder alone can place e.g. 2.1.1 under 1 if it was reordered in a flat list.
          orderBy: [{ wbsNode: { code: 'asc' } }],
        },
      },
    })

    if (!schedule) return null
    try {
      await assertProjectAccess(schedule.projectId, org)
    } catch {
      return null
    }

    const baselineSchedule = await prisma.schedule.findFirst({
      where: {
        projectId: schedule.projectId,
        orgId: org.orgId,
        isBaseline: true,
      },
      select: { id: true },
    })

    let baselinePlanByWbsNodeId: Record<
      string,
      { plannedStartDate: string; plannedEndDate: string }
    > | null = null

    if (baselineSchedule && baselineSchedule.id !== schedule.id) {
      const baselineTasks = await prisma.scheduleTask.findMany({
        where: { scheduleId: baselineSchedule.id },
        select: {
          wbsNodeId: true,
          plannedStartDate: true,
          plannedEndDate: true,
        },
      })
      if (baselineTasks.length > 0) {
        baselinePlanByWbsNodeId = Object.fromEntries(
          baselineTasks.map((t) => [
            t.wbsNodeId,
            {
              plannedStartDate: t.plannedStartDate.toISOString(),
              plannedEndDate: t.plannedEndDate.toISOString(),
            },
          ])
        )
      }
    }

    const nonWorkingDates = parseNonWorkingDatesFromJson(schedule.nonWorkingDates)

    return JSON.parse(
      JSON.stringify({
        ...schedule,
        nonWorkingDates,
        baselinePlanByWbsNodeId,
        projectStartDate: schedule.projectStartDate.toISOString(),
        projectEndDate: schedule.projectEndDate.toISOString(),
        baselineDate: schedule.baselineDate?.toISOString() ?? null,
        approvedAt: schedule.approvedAt?.toISOString() ?? null,
        createdAt: schedule.createdAt.toISOString(),
        updatedAt: schedule.updatedAt.toISOString(),
        tasks: schedule.tasks.map((task) => ({
          ...task,
          plannedStartDate: task.plannedStartDate.toISOString(),
          plannedEndDate: task.plannedEndDate.toISOString(),
          actualStartDate: task.actualStartDate?.toISOString() ?? null,
          actualEndDate: task.actualEndDate?.toISOString() ?? null,
          earlyStart: task.earlyStart?.toISOString() ?? null,
          earlyFinish: task.earlyFinish?.toISOString() ?? null,
          lateStart: task.lateStart?.toISOString() ?? null,
          lateFinish: task.lateFinish?.toISOString() ?? null,
          constraintDate: task.constraintDate?.toISOString() ?? null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          progressPercent: Number(task.progressPercent),
        })),
      })
    )
  } catch (error) {
    console.error('Error getting schedule for view:', error)
    return null
  }
}
