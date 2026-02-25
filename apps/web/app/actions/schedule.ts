'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { prisma } from '@repo/database'
import { revalidatePath } from 'next/cache'
import { Decimal } from '@prisma/client/runtime/library'
import { calculateCriticalPath } from '@/lib/schedule/critical-path'
import { addWorkingDays, countWorkingDays } from '@/lib/schedule/working-days'
import { createAuditLog } from '@/lib/audit-log'
import { addDays, differenceInDays } from 'date-fns'

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
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.SCHEDULE)) {
      return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
  }

  try {
    // Validación: proyecto debe tener presupuesto aprobado o baseline
    const approvedBudget = await prisma.budgetVersion.findFirst({
      where: {
        projectId,
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
      where: { projectId, orgId: org.orgId, active: true },
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
        projectId,
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
        projectId,
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
          progressPercent: new Decimal(0),
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
      projectId,
      description: `Cronograma "${data.name}" creado con ${wbsNodes.length} tareas`,
    })

    revalidatePath(`/projects/${projectId}/schedule`)

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
  }
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const task = await prisma.scheduleTask.findFirst({
      where: { id: taskId },
      include: {
        schedule: {
          select: {
            id: true,
            status: true,
            projectId: true,
            orgId: true,
            workingDaysPerWeek: true,
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
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.SCHEDULE)) {
        return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (task.schedule.status !== 'DRAFT') {
      return { success: false, error: 'Solo se puede editar cronogramas en DRAFT' }
    }

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
    } = {}
    if (data.plannedStartDate != null) updateData.plannedStartDate = data.plannedStartDate
    if (data.plannedEndDate != null) updateData.plannedEndDate = data.plannedEndDate
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.plannedDuration != null) {
      updateData.plannedDuration = data.plannedDuration
      // Si solo envían duración, recalcular fin = inicio + duración (días laborables)
      if (data.plannedEndDate == null) {
        const start = new Date(task.plannedStartDate)
        updateData.plannedEndDate = addWorkingDays(
          start,
          data.plannedDuration,
          task.schedule.workingDaysPerWeek
        )
      }
    }

    const beforeDates = {
      plannedStartDate: task.plannedStartDate,
      plannedEndDate: task.plannedEndDate,
      plannedDuration: task.plannedDuration,
    }

    await prisma.scheduleTask.update({
      where: { id: taskId },
      data: updateData,
    })

    if (task.wbsNode.parentId) {
      await recalculateParentSummaryTasks(
        task.schedule.id,
        task.wbsNode.parentId,
        task.schedule.workingDaysPerWeek
      )
    }

    await recalculateCriticalPath(task.schedule.id)

    const afterTask = await prisma.scheduleTask.findUnique({
      where: { id: taskId },
      select: {
        plannedStartDate: true,
        plannedEndDate: true,
        plannedDuration: true,
      },
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE_TASK_DATES',
      entity: 'ScheduleTask',
      entityId: taskId,
      projectId: task.schedule.projectId,
      oldValues: beforeDates,
      newValues: afterTask ?? undefined,
      description: `Fechas de tarea actualizadas: ${task.wbsNode.code}`,
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
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: data.scheduleId, orgId: org.orgId },
    })

    if (!schedule) {
      return { success: false, error: 'Schedule not found' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.SCHEDULE)) {
        return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (schedule.status !== 'DRAFT') {
      return { success: false, error: 'Solo se puede editar en DRAFT' }
    }

    const wouldCreateCycle = await checkForCycle(
      data.scheduleId,
      data.predecessorId,
      data.successorId
    )

    if (wouldCreateCycle) {
      return {
        success: false,
        error: 'Esta dependencia crearía un ciclo. No es permitido.',
      }
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        scheduleId: data.scheduleId,
        predecessorId: data.predecessorId,
        successorId: data.successorId,
        dependencyType: data.dependencyType,
        lagDays: data.lagDays ?? 0,
      },
    })

    await recalculateCriticalPath(data.scheduleId)

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'CREATE',
      entity: 'TaskDependency',
      entityId: dependency.id,
      projectId: schedule.projectId,
      description: `Dependencia ${data.dependencyType} agregada`,
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
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const dependency = await prisma.taskDependency.findFirst({
      where: { id: dependencyId },
      include: {
        schedule: { select: { id: true, orgId: true, projectId: true, status: true } },
      },
    })

    if (!dependency || dependency.schedule.orgId !== org.orgId) {
      return { success: false, error: 'Dependency not found' }
    }
    try {
      const access = await assertProjectAccess(dependency.schedule.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.SCHEDULE)) {
        return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (dependency.schedule.status !== 'DRAFT') {
      return { success: false, error: 'Solo se puede editar en DRAFT' }
    }

    await prisma.taskDependency.delete({ where: { id: dependencyId } })

    await recalculateCriticalPath(dependency.schedule.id)

    revalidatePath(`/projects/${dependency.schedule.projectId}/schedule`)

    return { success: true }
  } catch (error) {
    console.error('Error removing dependency:', error)
    return { success: false, error: 'Error al eliminar dependencia' }
  }
}

/**
 * Actualizar progreso de tarea
 */
export async function updateTaskProgress(
  taskId: string,
  data: {
    progressPercent: number
    actualStartDate?: Date
    actualEndDate?: Date
  }
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'EDITOR')

  try {
    const task = await prisma.scheduleTask.findFirst({
      where: { id: taskId },
      include: {
        schedule: { select: { orgId: true, projectId: true } },
      },
    })

    if (!task || task.schedule.orgId !== org.orgId) {
      return { success: false, error: 'Task not found' }
    }
    try {
      const access = await assertProjectAccess(task.schedule.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.SCHEDULE)) {
        return { success: false, error: 'No tenés permiso para editar el cronograma de este proyecto' }
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Acceso denegado' }
    }

    if (data.progressPercent < 0 || data.progressPercent > 100) {
      return { success: false, error: 'El progreso debe estar entre 0 y 100' }
    }

    const updateData: {
      progressPercent: Decimal
      actualStartDate?: Date
      actualEndDate?: Date
      actualDuration?: number
    } = {
      progressPercent: new Decimal(data.progressPercent),
    }
    if (data.actualStartDate != null) updateData.actualStartDate = data.actualStartDate
    if (data.actualEndDate != null) updateData.actualEndDate = data.actualEndDate
    if (data.actualStartDate != null && data.actualEndDate != null) {
      updateData.actualDuration = Math.ceil(
        (data.actualEndDate.getTime() - data.actualStartDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    }

    await prisma.scheduleTask.update({
      where: { id: taskId },
      data: updateData,
    })

    revalidatePath(`/projects/${task.schedule.projectId}/schedule`)

    return { success: true }
  } catch (error) {
    console.error('Error updating task progress:', error)
    return { success: false, error: 'Error al actualizar progreso' }
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
      schedule.workingDaysPerWeek
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

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { projectEndDate: maxFinish },
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
  workingDaysPerWeek: number
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
      workingDaysPerWeek
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
        workingDaysPerWeek
      )
    }
  } catch (error) {
    console.error('Error recalculating parent summary:', error)
  }
}

/**
 * Detectar si agregar predecessorId -> successorId crearía un ciclo.
 * Ciclo existe si ya hay un camino desde successorId hasta predecessorId (en grafo de dependencias).
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

  // Grafo inverso: para cada (pred, succ) tenemos arista succ -> pred (quién apunta a quién en reverso)
  const revAdj = new Map<string, string[]>()
  for (const d of deps) {
    const list = revAdj.get(d.successorId) ?? []
    list.push(d.predecessorId)
    revAdj.set(d.successorId, list)
  }
  // Nueva arista: predecessorId -> successorId, en reverso successorId -> predecessorId
  const newList = revAdj.get(successorId) ?? []
  newList.push(predecessorId)
  revAdj.set(successorId, newList)

  const visited = new Set<string>()
  function dfs(nodeId: string): boolean {
    if (nodeId === predecessorId) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    for (const next of revAdj.get(nodeId) ?? []) {
      if (dfs(next)) return true
    }
    return false
  }
  return dfs(successorId)
}

/**
 * Establecer cronograma como BASELINE
 */
export async function setScheduleAsBaseline(scheduleId: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const org = await getOrgContext(session.user.id)
  if (!org) return { success: false, error: 'Unauthorized' }
  requireRole(org.role, 'ADMIN')

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, orgId: org.orgId },
      include: { project: { select: { id: true, name: true } } },
    })

    if (!schedule) {
      return { success: false, error: 'Schedule not found' }
    }
    try {
      const access = await assertProjectAccess(schedule.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.SCHEDULE)) {
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
      where: { id: scheduleId },
      data: {
        status: 'BASELINE',
        isBaseline: true,
        baselineDate: new Date(),
      },
    })

    await createAuditLog({
      orgId: org.orgId,
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Schedule',
      entityId: scheduleId,
      projectId: schedule.projectId,
      description: `Cronograma establecido como BASELINE en proyecto "${schedule.project.name}"`,
    })

    revalidatePath(`/projects/${schedule.projectId}/schedule`)

    return { success: true }
  } catch (error) {
    console.error('Error setting baseline:', error)
    return { success: false, error: 'Error al establecer baseline' }
  }
}

/**
 * Obtener cronograma completo para vista (con serialización de fechas para hidratación)
 */
export async function getScheduleForView(scheduleId: string) {
  const session = await getSession()
  if (!session?.user?.id) return null

  const org = await getOrgContext(session.user.id)
  if (!org) return null

  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, orgId: org.orgId },
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
          orderBy: [{ wbsNode: { sortOrder: 'asc' } }, { wbsNode: { code: 'asc' } }],
        },
      },
    })

    if (!schedule) return null
    try {
      await assertProjectAccess(schedule.projectId, org)
    } catch {
      return null
    }

    return JSON.parse(
      JSON.stringify({
        ...schedule,
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
