import { z } from 'zod'

export const BUDGET_VERSION_TYPE = [
  'INITIAL',
  'BASELINE',
  'APPROVED',
  'WORKING',
  'CHANGE_ORDER',
] as const
export type BudgetVersionType = (typeof BUDGET_VERSION_TYPE)[number]

export const BUDGET_STATUS = ['DRAFT', 'BASELINE', 'APPROVED'] as const
export type BudgetStatus = (typeof BUDGET_STATUS)[number]

export const createBudgetVersionSchema = z.object({
  versionType: z.enum(BUDGET_VERSION_TYPE).default('WORKING'),
  notes: z.string().max(2000).optional().nullable(),
})

export type CreateBudgetVersionInput = z.infer<typeof createBudgetVersionSchema>

export const updateBudgetVersionSchema = z.object({
  versionType: z.enum(BUDGET_VERSION_TYPE).optional(),
  notes: z.string().max(2000).optional().nullable(),
})

export type UpdateBudgetVersionInput = z.infer<typeof updateBudgetVersionSchema>

export const createBudgetLineSchema = z.object({
  wbsNodeId: z.string().uuid(),
  resourceId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  description: z.string().min(1, 'Description is required').max(500),
  unit: z.string().min(1, 'Unit is required').max(50),
  quantity: z.coerce.number().min(0, 'Quantity must be non-negative'),
  unitCost: z.coerce.number().nonnegative('Unit cost must be non-negative'),
  indirectCostPct: z.coerce.number().min(0).max(100).optional(),
})
export type CreateBudgetLineInput = z.infer<typeof createBudgetLineSchema>

export const updateBudgetLineSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  unit: z.string().min(1).max(50).optional(),
  quantity: z.coerce.number().min(0).optional(),
  unitCost: z.coerce.number().nonnegative().optional(),
  indirectCostPct: z.coerce.number().min(0).max(100).optional(),
})
export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineSchema>

export const BUDGET_RESOURCE_TYPES = ['MATERIAL', 'LABOR', 'EQUIPMENT'] as const
export type BudgetResourceType = (typeof BUDGET_RESOURCE_TYPES)[number]

export const budgetResourceSchema = z.object({
  type: z.enum(BUDGET_RESOURCE_TYPES),
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  unit: z.string().min(1, 'La unidad es requerida'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().min(0, 'El costo unitario no puede ser negativo'),
  supplierName: z.string().optional(),
})
export type BudgetResourceInput = z.infer<typeof budgetResourceSchema>
