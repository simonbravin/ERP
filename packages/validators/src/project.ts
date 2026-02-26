import { z } from 'zod'

/** Parse YYYY-MM-DD as UTC noon so the calendar day does not shift in any timezone */
function parseDateOnly(v: unknown): Date | undefined | null {
  if (v === '' || v === undefined) return undefined
  if (v === null) return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const parts = v.split('-').map(Number)
    const y = parts[0] ?? 0
    const m = (parts[1] ?? 1) - 1
    const d = parts[2] ?? 1
    return new Date(Date.UTC(y, m, d, 12, 0, 0, 0))
  }
  if (v instanceof Date) return v
  return z.coerce.date().parse(v)
}

export const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255),
  clientName: z.string().max(255).optional(),
  location: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  m2: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.coerce.number().positive().optional().nullable()
  ),
  startDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

const PROJECT_PHASE_ENUM = z.enum(['PRE_CONSTRUCTION', 'CONSTRUCTION', 'CLOSEOUT', 'COMPLETE'])

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  clientName: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  m2: z.coerce.number().positive().optional().nullable(),
  status: z.string().max(50).optional(),
  // Mismo tratamiento que status: preprocess vacío → undefined para no fallar; enum igual que Prisma
  phase: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    PROJECT_PHASE_ENUM.optional()
  ),
  startDate: z.preprocess(
    (v) => (v === '' ? null : parseDateOnly(v)),
    z.date().optional().nullable()
  ),
  plannedEndDate: z.preprocess(
    (v) => (v === '' ? null : parseDateOnly(v)),
    z.date().optional().nullable()
  ),
  active: z.boolean().optional(),
})

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
