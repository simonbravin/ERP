import { z } from 'zod'

/**
 * Tier 2 - Libro de Obra integration with WBS, Inventory, Suppliers, Budget, Finance.
 * Use when submitting a daily report with cost breakdown and module links.
 */

export const consumptionEntrySchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  costPerUnit: z.number().min(0).optional(),
})

export const supplierInteractionSchema = z.object({
  globalPartyId: z.string().uuid(),
  type: z.enum(['PURCHASE', 'DELIVERY', 'ISSUE', 'COMMUNICATION', 'VISIT']),
  amount: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  quantityUnit: z.string().optional(),
  deliveryStatus: z.enum(['ON_TIME', 'LATE', 'PARTIAL', 'FULL']).optional(),
  quality: z.enum(['PERFECT', 'GOOD', 'ACCEPTABLE', 'POOR', 'REJECTED']).optional(),
  description: z.string().optional(),
})

export const submitDailyReportTier2Schema = z.object({
  reportId: z.string().uuid(),
  budgetLineId: z.string().uuid().optional().nullable(),
  laborCosts: z.number().min(0).default(0),
  materialCosts: z.number().min(0).default(0),
  otherCosts: z.number().min(0).default(0),
  consumptions: z.array(consumptionEntrySchema).optional().default([]),
  suppliers: z.array(supplierInteractionSchema).optional().default([]),
})

export type SubmitDailyReportTier2Input = z.infer<typeof submitDailyReportTier2Schema>
export type ConsumptionEntry = z.infer<typeof consumptionEntrySchema>
export type SupplierInteractionEntry = z.infer<typeof supplierInteractionSchema>
