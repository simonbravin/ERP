import { z } from 'zod'

// ============================================================================
// INVENTORY ITEM VALIDATORS
// ============================================================================

export const createInventoryItemSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU es requerido')
    .max(50, 'SKU debe tener máximo 50 caracteres')
    .regex(
      /^[A-Za-z0-9-]+$/,
      'SKU debe contener solo letras, números y guiones'
    ),
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(255, 'Nombre debe tener máximo 255 caracteres'),
  description: z
    .string()
    .max(1000, 'Descripción debe tener máximo 1000 caracteres')
    .optional(),
  category: z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER'], {
    errorMap: () => ({ message: 'Categoría inválida' }),
  }),
  unit: z
    .string()
    .min(1, 'Unidad es requerida')
    .max(20, 'Unidad debe tener máximo 20 caracteres'),
  minStockQty: z
    .coerce.number()
    .nonnegative('Stock mínimo no puede ser negativo')
    .optional(),
  reorderQty: z
    .coerce.number()
    .positive('Cantidad de reposición debe ser mayor a 0')
    .optional(),
})

export const updateInventoryItemSchema = createInventoryItemSchema.partial()

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>

// ============================================================================
// INVENTORY MOVEMENT VALIDATORS
// ============================================================================

const baseMovementSchema = z.object({
  itemId: z.string().uuid('ID de item inválido'),
  quantity: z
    .coerce.number()
    .positive('La cantidad debe ser mayor a 0')
    .max(999999, 'Cantidad demasiado grande'),
  unitCost: z
    .coerce.number()
    .nonnegative('El costo no puede ser negativo')
    .optional(),
  notes: z
    .string()
    .max(1000, 'Notas deben tener máximo 1000 caracteres')
    .optional(),
  idempotencyKey: z.string().min(1, 'Clave de idempotencia requerida').optional(),
})

const purchaseMovementSchema = baseMovementSchema.extend({
  movementType: z.literal('PURCHASE'),
  toLocationId: z.string().uuid('Ubicación destino es requerida'),
  fromLocationId: z.undefined(),
  projectId: z.string().uuid().optional(),
  wbsNodeId: z.undefined(),
  unitCost: z.coerce.number().positive('Costo unitario es requerido para compras'),
})

const transferMovementSchema = baseMovementSchema.extend({
  movementType: z.literal('TRANSFER'),
  fromLocationId: z.string().uuid('Ubicación origen es requerida'),
  toLocationId: z.string().uuid('Ubicación destino es requerida'),
  projectId: z.undefined(),
  wbsNodeId: z.undefined(),
  unitCost: z.coerce.number().nonnegative().optional(),
})

const issueMovementSchema = baseMovementSchema.extend({
  movementType: z.literal('ISSUE'),
  fromLocationId: z.string().uuid('Ubicación origen es requerida'),
  toLocationId: z.undefined(),
  projectId: z.string().uuid('Proyecto es requerido para consumo'),
  wbsNodeId: z.string().uuid('WBS es requerido para consumo'),
  unitCost: z.coerce.number().nonnegative('Costo unitario es requerido para consumo'),
})

const adjustmentMovementSchema = baseMovementSchema
  .extend({
    movementType: z.literal('ADJUSTMENT'),
    toLocationId: z.string().uuid().optional(),
    fromLocationId: z.string().uuid().optional(),
    projectId: z.undefined(),
    wbsNodeId: z.undefined(),
    unitCost: z.coerce.number().nonnegative().optional(),
    notes: z
      .string()
      .min(10, 'Debes especificar la razón del ajuste (mínimo 10 caracteres)'),
  })
  .refine(
    (data) =>
      (data.toLocationId != null && data.fromLocationId == null) ||
      (data.fromLocationId != null && data.toLocationId == null),
    {
      message: 'Indica ubicación destino (sumar) u origen (restar)',
      path: ['toLocationId'],
    }
  )

export const createInventoryMovementSchema = z.union([
  purchaseMovementSchema,
  transferMovementSchema,
  issueMovementSchema,
  adjustmentMovementSchema,
])

export type CreateInventoryMovementInput = z.infer<typeof createInventoryMovementSchema>

// ============================================================================
// LOCATION VALIDATORS (ERD: CENTRAL_WAREHOUSE | PROJECT_SITE | SUPPLIER)
// ============================================================================

export const createInventoryLocationSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(255, 'Nombre debe tener máximo 255 caracteres'),
  type: z.enum(['CENTRAL_WAREHOUSE', 'PROJECT_SITE', 'SUPPLIER'], {
    errorMap: () => ({ message: 'Tipo de ubicación inválido' }),
  }),
  address: z
    .string()
    .max(500, 'Dirección debe tener máximo 500 caracteres')
    .optional(),
  projectId: z
    .string()
    .uuid('ID de proyecto inválido')
    .optional()
    .nullable(),
})

export const updateInventoryLocationSchema = createInventoryLocationSchema.partial()

export type CreateInventoryLocationInput = z.infer<typeof createInventoryLocationSchema>
export type UpdateInventoryLocationInput = z.infer<typeof updateInventoryLocationSchema>
