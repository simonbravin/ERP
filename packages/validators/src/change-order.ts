import { z } from 'zod'

export const CHANGE_ORDER_STATUS = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
] as const
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUS)[number]

export const BUDGET_IMPACT_TYPE = ['DEVIATION', 'APPROVED_CHANGE'] as const
export type BudgetImpactType = (typeof BUDGET_IMPACT_TYPE)[number]

export const CHANGE_ORDER_LINE_TYPE = ['ADD', 'MODIFY', 'DELETE'] as const
export type ChangeOrderLineType = (typeof CHANGE_ORDER_LINE_TYPE)[number]

/** Parse YYYY-MM-DD as date for request/approved/implemented dates */
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

export const createChangeOrderSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  reason: z.string().min(1, 'Reason is required').max(2000),
  justification: z.string().max(2000).optional().nullable(),
  changeType: z.string().max(50).default('SCOPE'),
  budgetImpactType: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.enum(BUDGET_IMPACT_TYPE).optional()
  ),
  costImpact: z.coerce.number().default(0),
  timeImpactDays: z.coerce.number().int().min(0).default(0),
  requestDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
  implementedDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
})
export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>

export const updateChangeOrderSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  reason: z.string().min(1).max(2000).optional(),
  justification: z.string().max(2000).optional().nullable(),
  changeType: z.string().max(50).optional(),
  budgetImpactType: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.enum(BUDGET_IMPACT_TYPE).optional()
  ),
  status: z.enum(CHANGE_ORDER_STATUS).optional(),
  costImpact: z.coerce.number().optional(),
  timeImpactDays: z.coerce.number().int().min(0).optional(),
  requestDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
  approvedDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
  implementedDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
  partyId: z.string().uuid().optional().nullable(),
})
export type UpdateChangeOrderInput = z.infer<typeof updateChangeOrderSchema>

export const createChangeOrderLineSchema = z.object({
  wbsNodeId: z.string().uuid(),
  changeType: z.enum(CHANGE_ORDER_LINE_TYPE).default('ADD'),
  justification: z.string().min(1, 'Justification is required').max(500),
  deltaCost: z.coerce.number(),
  newQty: z.coerce.number().nonnegative().optional().nullable(),
  newUnitCost: z.coerce.number().nonnegative().optional().nullable(),
})
export type CreateChangeOrderLineInput = z.infer<typeof createChangeOrderLineSchema>

export const updateChangeOrderLineSchema = z.object({
  wbsNodeId: z.string().uuid().optional(),
  changeType: z.enum(CHANGE_ORDER_LINE_TYPE).optional(),
  justification: z.string().min(1).max(500).optional(),
  deltaCost: z.coerce.number().optional(),
  newQty: z.coerce.number().nonnegative().optional().nullable(),
  newUnitCost: z.coerce.number().nonnegative().optional().nullable(),
})
export type UpdateChangeOrderLineInput = z.infer<typeof updateChangeOrderLineSchema>

/** Form payload: one change order header + optional lines (for create/update with lines) */
export const changeOrderFormSchema = z.object({
  title: z.string().min(1).max(255),
  reason: z.string().min(1).max(2000),
  justification: z.string().max(2000).optional().nullable(),
  changeType: z.string().max(50),
  budgetImpactType: z.enum(BUDGET_IMPACT_TYPE),
  costImpact: z.coerce.number(),
  timeImpactDays: z.coerce.number().int().min(0),
  requestDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
  implementedDate: z.preprocess(parseDateOnly, z.date().optional().nullable()),
  lines: z.array(z.object({
    id: z.string().uuid().optional(),
    wbsNodeId: z.string().uuid(),
    changeType: z.enum(CHANGE_ORDER_LINE_TYPE),
    justification: z.string().min(1).max(500),
    deltaCost: z.coerce.number(),
  })).default([]),
})
export type ChangeOrderFormInput = z.infer<typeof changeOrderFormSchema>
