import { z } from 'zod'

export const scheduleIdSchema = z.object({
  scheduleId: z.string().uuid('ID de cronograma inválido'),
})

export const projectIdSchema = z.object({
  projectId: z.string().uuid('ID de proyecto inválido'),
})

export const taskIdSchema = z.object({
  taskId: z.string().uuid('ID de tarea inválido'),
})

export const dependencyIdSchema = z.object({
  dependencyId: z.string().uuid('ID de dependencia inválido'),
})

export const addTaskDependencySchema = z.object({
  scheduleId: z.string().uuid('ID de cronograma inválido'),
  predecessorId: z.string().uuid('ID de predecesor inválido'),
  successorId: z.string().uuid('ID de sucesor inválido'),
  dependencyType: z.enum(['FS', 'SS', 'FF', 'SF']),
  lagDays: z.number().int().optional(),
})

export function parseScheduleId(scheduleId: string): { success: true; scheduleId: string } | { success: false; error: string } {
  const r = scheduleIdSchema.safeParse({ scheduleId })
  if (r.success) return { success: true, scheduleId: r.data.scheduleId }
  return { success: false, error: r.error.flatten().formErrors[0] ?? 'Datos inválidos' }
}

export function parseProjectId(projectId: string): { success: true; projectId: string } | { success: false; error: string } {
  const r = projectIdSchema.safeParse({ projectId })
  if (r.success) return { success: true, projectId: r.data.projectId }
  return { success: false, error: r.error.flatten().formErrors[0] ?? 'Datos inválidos' }
}

export function parseTaskId(taskId: string): { success: true; taskId: string } | { success: false; error: string } {
  const r = taskIdSchema.safeParse({ taskId })
  if (r.success) return { success: true, taskId: r.data.taskId }
  return { success: false, error: r.error.flatten().formErrors[0] ?? 'Datos inválidos' }
}

export function parseDependencyId(dependencyId: string): { success: true; dependencyId: string } | { success: false; error: string } {
  const r = dependencyIdSchema.safeParse({ dependencyId })
  if (r.success) return { success: true, dependencyId: r.data.dependencyId }
  return { success: false, error: r.error.flatten().formErrors[0] ?? 'Datos inválidos' }
}
