import { z } from 'zod'

export const TRANSACTION_TYPE = [
  'INVOICE_RECEIVED',
  'PAYMENT_MADE',
  'EXPENSE',
  'ADVANCE_PAYMENT',
  'REFUND',
] as const
export type TransactionType = (typeof TRANSACTION_TYPE)[number]

export const TRANSACTION_STATUS = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PAID',
  'VOIDED',
] as const
export type TransactionStatus = (typeof TRANSACTION_STATUS)[number]

export const DOCUMENT_TYPE = ['INVOICE', 'RECEIPT', 'CREDIT_NOTE', 'DEBIT_NOTE'] as const
export type DocumentType = (typeof DOCUMENT_TYPE)[number]

const TYPE_PREFIX: Record<TransactionType, string> = {
  INVOICE_RECEIVED: 'INV',
  PAYMENT_MADE: 'PAY',
  EXPENSE: 'EXP',
  ADVANCE_PAYMENT: 'ADV',
  REFUND: 'REF',
}
export function getTransactionTypePrefix(type: TransactionType): string {
  return TYPE_PREFIX[type] ?? 'TXN'
}

export const createFinanceTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPE),
  description: z.string().min(1, 'Description is required').max(2000),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  projectId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  partyId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  currencyCode: z.string().length(3, 'Currency code must be 3 characters').default('USD'),
  exchangeRateSnapshot: z.coerce.number().positive('Exchange rate must be positive').default(1),
  reference: z.string().max(200).optional().nullable(),
})
export type CreateFinanceTransactionInput = z.infer<typeof createFinanceTransactionSchema>

export const updateFinanceTransactionSchema = z.object({
  description: z.string().min(1).max(2000).optional(),
  documentType: z.enum(DOCUMENT_TYPE).optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  projectId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  partyId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  currencyCode: z.string().length(3).optional(),
  exchangeRateSnapshot: z.coerce.number().positive().optional(),
  reference: z.string().max(200).optional().nullable(),
  retentionAmount: z.coerce.number().nonnegative().optional(),
  adjustmentAmount: z.coerce.number().optional(),
  adjustmentNotes: z.string().max(1000).optional().nullable(),
})
export type UpdateFinanceTransactionInput = z.infer<typeof updateFinanceTransactionSchema>

export const createFinanceLineSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.coerce.number(),
  wbsNodeId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  unit: z.string().max(50).optional().nullable(),
  quantity: z.coerce.number().nonnegative().optional(),
})
export type CreateFinanceLineInput = z.infer<typeof createFinanceLineSchema>

export const updateFinanceLineSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  amount: z.coerce.number().optional(),
  wbsNodeId: z
    .union([z.string().uuid(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  unit: z.string().max(50).optional().nullable(),
  quantity: z.coerce.number().nonnegative().optional(),
})
export type UpdateFinanceLineInput = z.infer<typeof updateFinanceLineSchema>

// Project-scoped transaction (simplified create/update for project finance tab)
export const PROJECT_TRANSACTION_TYPE = ['EXPENSE', 'INCOME', 'PURCHASE', 'SALE', 'OVERHEAD'] as const
export type ProjectTransactionType = (typeof PROJECT_TRANSACTION_TYPE)[number]

export const projectTransactionCreateSchema = z.object({
  type: z.enum(PROJECT_TRANSACTION_TYPE),
  documentType: z.enum(DOCUMENT_TYPE).optional().default('INVOICE'),
  partyId: z.string().uuid().optional().nullable(),
  description: z.string().min(3, 'Mínimo 3 caracteres'),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  currency: z.string().length(3).default('ARS'),
  exchangeRate: z.number().positive().optional(), // 1 unidad de currency = X ARS (solo si currency !== ARS)
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  reference: z.string().max(200).optional().nullable(),
  retentionAmount: z.coerce.number().nonnegative().optional().default(0),
  adjustmentAmount: z.coerce.number().optional().default(0),
  adjustmentNotes: z.string().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        unit: z.string().max(50).optional().nullable(),
        quantity: z.number().positive(),
        unitPrice: z.number(),
        lineTotal: z.number(),
        wbsNodeId: z.string().uuid().optional().nullable(),
      })
    )
    .optional(),
})
export type ProjectTransactionCreateInput = z.infer<typeof projectTransactionCreateSchema>

export const projectTransactionUpdateSchema = z.object({
  description: z.string().min(3).optional(),
  documentType: z.enum(DOCUMENT_TYPE).optional(),
  status: z.enum(TRANSACTION_STATUS).optional(),
  partyId: z.string().uuid().optional().nullable(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  paidDate: z.coerce.date().optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  subtotal: z.number().nonnegative().optional(),
  taxTotal: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  retentionAmount: z.coerce.number().nonnegative().optional(),
  adjustmentAmount: z.coerce.number().optional(),
  adjustmentNotes: z.string().max(1000).optional().nullable(),
})
export type ProjectTransactionUpdateInput = z.infer<typeof projectTransactionUpdateSchema>
