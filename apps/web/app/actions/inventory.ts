'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { requirePermission, getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess } from '@/lib/project-permissions'
import { publishOutboxEvent } from '@/lib/events/event-publisher'
import { calculateTotalStock, calculateStockBalance } from '@/lib/inventory-utils'
import { createInAppNotificationsForUsers } from '@/app/actions/notifications'

/** List all inventory categories (for dropdowns). */
export async function getInventoryCategories() {
  await getAuthContext()
  return prisma.inventoryCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, sortOrder: true },
  })
}

/** List subcategories for a category (optional: pass categoryId to filter). */
export async function getInventorySubcategories(categoryId?: string | null) {
  await getAuthContext()
  return prisma.inventorySubcategory.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, categoryId: true, name: true, sortOrder: true },
  })
}

/** Create a new category (for "add new" in form). */
export async function createInventoryCategory(name: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')
  const maxOrder = await prisma.inventoryCategory.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const created = await prisma.$transaction(async (tx) => {
    const cat = await tx.inventoryCategory.create({
      data: { name: name.trim(), sortOrder: (maxOrder?.sortOrder ?? -1) + 1 },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'INVENTORY_CATEGORY.CREATED',
      entityType: 'InventoryCategory',
      entityId: cat.id,
      payload: { name: cat.name },
    })
    return cat
  })
  revalidatePath('/inventory/items')
  revalidatePath('/inventory/items/new')
  return { success: true as const, category: { id: created.id, name: created.name } }
}

/** Create a new subcategory under a category. */
export async function createInventorySubcategory(categoryId: string, name: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')
  const maxOrder = await prisma.inventorySubcategory.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const created = await prisma.$transaction(async (tx) => {
    const sub = await tx.inventorySubcategory.create({
      data: { categoryId, name: name.trim(), sortOrder: (maxOrder?.sortOrder ?? -1) + 1 },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'INVENTORY_SUBCATEGORY.CREATED',
      entityType: 'InventorySubcategory',
      entityId: sub.id,
      payload: { categoryId, name: sub.name },
    })
    return sub
  })
  revalidatePath('/inventory/items')
  revalidatePath('/inventory/items/new')
  return { success: true as const, subcategory: { id: created.id, name: created.name } }
}

export async function createInventoryItem(data: {
  sku: string
  name: string
  description?: string
  categoryId: string
  subcategoryId?: string | null
  unit: string
  minStockQty?: number
  reorderQty?: number
}) {
  await requirePermission('INVENTORY', 'create')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await prisma.inventoryItem.findUnique({
    where: { orgId_sku: { orgId: org.orgId, sku: data.sku } },
  })
  if (existing) return { success: false as const, error: 'SKU ya existe' }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        orgId: org.orgId,
        sku: data.sku,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId ?? undefined,
        unit: data.unit,
        minStockQty: data.minStockQty != null ? new Prisma.Decimal(data.minStockQty) : null,
        reorderQty: data.reorderQty != null ? new Prisma.Decimal(data.reorderQty) : null,
        active: true,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'INVENTORY_ITEM.CREATED',
      entityType: 'InventoryItem',
      entityId: created.id,
      payload: { sku: created.sku, name: created.name },
    })
    return created
  })

  revalidatePath('/inventory')
  revalidatePath('/inventory/items')
  return { success: true as const, itemId: item.id }
}

export async function updateInventoryItem(
  itemId: string,
  data: {
    sku: string
    name: string
    description?: string
    categoryId: string
    subcategoryId?: string | null
    unit: string
    minStockQty?: number
    reorderQty?: number
  }
) {
  await requirePermission('INVENTORY', 'edit')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, orgId: org.orgId },
  })
  if (!item) return { success: false as const, error: 'Item no encontrado' }

  const existingSku = await prisma.inventoryItem.findUnique({
    where: { orgId_sku: { orgId: org.orgId, sku: data.sku } },
  })
  if (existingSku && existingSku.id !== itemId) {
    return { success: false as const, error: 'SKU ya existe' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId ?? undefined,
        unit: data.unit,
        minStockQty: data.minStockQty != null ? new Prisma.Decimal(data.minStockQty) : null,
        reorderQty: data.reorderQty != null ? new Prisma.Decimal(data.reorderQty) : null,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'INVENTORY_ITEM.UPDATED',
      entityType: 'InventoryItem',
      entityId: itemId,
      payload: { sku: data.sku, name: data.name },
    })
  })

  revalidatePath('/inventory')
  revalidatePath('/inventory/items')
  revalidatePath(`/inventory/items/${itemId}`)
  return { success: true as const }
}

export async function deleteInventoryItem(itemId: string) {
  await requirePermission('INVENTORY', 'delete')
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, orgId: org.orgId },
    select: { id: true },
  })
  if (!item) return { success: false as const, error: 'Item no encontrado' }

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { active: false },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'INVENTORY_ITEM.DELETED',
      entityType: 'InventoryItem',
      entityId: itemId,
      payload: {},
    })
  })

  revalidatePath('/inventory')
  revalidatePath('/inventory/items')
  return { success: true as const }
}

export async function createInventoryLocation(data: {
  type: string
  name: string
  projectId?: string | null
  address?: string
}) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  if (data.type === 'PROJECT_SITE' && !data.projectId) {
    throw new Error('Project is required for project site locations')
  }

  const loc = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryLocation.create({
      data: {
        orgId: org.orgId,
        type: data.type,
        name: data.name,
        projectId: data.projectId || undefined,
        address: data.address,
        active: true,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'INVENTORY_LOCATION.CREATED',
      entityType: 'InventoryLocation',
      entityId: created.id,
      payload: { type: created.type, name: created.name },
    })
    return created
  })

  revalidatePath('/inventory')
  revalidatePath('/inventory/locations')
  return { success: true, locationId: loc.id }
}

export async function createInventoryMovement(data: {
  itemId: string
  movementType: 'PURCHASE' | 'TRANSFER' | 'ISSUE' | 'ADJUSTMENT'
  fromLocationId?: string | null
  toLocationId?: string | null
  projectId?: string | null
  wbsNodeId?: string | null
  quantity: number
  unitCost: number
  notes?: string
  idempotencyKey: string
}) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const existing = await prisma.inventoryMovement.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  })
  if (existing) {
    revalidatePath('/inventory/movements')
    return { success: true, movementId: existing.id, duplicate: true }
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: data.itemId, orgId: org.orgId },
  })
  if (!item) throw new Error('Item not found')

  if (data.movementType === 'PURCHASE' && !data.toLocationId) {
    throw new Error('Destination location required for PURCHASE')
  }
  if (
    data.movementType === 'TRANSFER' &&
    (!data.fromLocationId || !data.toLocationId)
  ) {
    throw new Error('Both locations required for TRANSFER')
  }
  if (
    data.movementType === 'ISSUE' &&
    (!data.fromLocationId || !data.projectId || !data.wbsNodeId)
  ) {
    throw new Error('From location, project, and WBS required for ISSUE')
  }
  if (data.movementType === 'ADJUSTMENT') {
    if (!data.fromLocationId && !data.toLocationId) {
      throw new Error('At least one location required for ADJUSTMENT')
    }
  }

  if (data.movementType === 'ISSUE' && data.fromLocationId) {
    const balance = await calculateStockBalance(
      data.itemId,
      data.fromLocationId,
      org.orgId
    )
    if (balance.lt(data.quantity)) {
      throw new Error(
        `Stock insuficiente. Disponible: ${balance.toString()}`
      )
    }
  }

  const totalCost = new Prisma.Decimal(data.quantity).mul(data.unitCost)

  // PURCHASE: always create FinanceTransaction (company expense; projectId optional for project allocation)
  if (data.movementType === 'PURCHASE') {
    const purchaseMovement = await prisma.$transaction(async (tx) => {
      const mov = await tx.inventoryMovement.create({
        data: {
          orgId: org.orgId,
          itemId: data.itemId,
          movementType: data.movementType,
          fromLocationId: undefined,
          toLocationId: data.toLocationId ?? undefined,
          projectId: data.projectId ?? undefined,
          wbsNodeId: data.wbsNodeId ?? undefined,
          quantity: new Prisma.Decimal(data.quantity),
          unitCost: new Prisma.Decimal(data.unitCost),
          totalCost,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
          createdByOrgMemberId: org.memberId,
        },
      })

      const year = new Date().getFullYear()
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year + 1, 0, 1)
      const count = await tx.financeTransaction.count({
        where: {
          orgId: org.orgId,
          type: 'PURCHASE',
          issueDate: { gte: yearStart, lt: yearEnd },
          deleted: false,
        },
      })
      const transactionNumber = `PUR-${year}-${(count + 1).toString().padStart(3, '0')}`

      const totalAmount = Number(totalCost.toString())
      const financeTx = await tx.financeTransaction.create({
        data: {
          orgId: org.orgId,
          projectId: data.projectId ?? undefined,
          type: 'PURCHASE',
          status: 'POSTED',
          transactionNumber,
          issueDate: new Date(),
          currency: 'USD',
          subtotal: new Prisma.Decimal(totalAmount),
          taxTotal: new Prisma.Decimal(0),
          total: new Prisma.Decimal(totalAmount),
          amountBaseCurrency: new Prisma.Decimal(totalAmount),
          description: `Compra inventario: ${item.name}`,
          reference: mov.id,
          createdByOrgMemberId: org.memberId,
        },
      })

      await tx.financeLine.create({
        data: {
          orgId: org.orgId,
          transactionId: financeTx.id,
          wbsNodeId: data.wbsNodeId ?? undefined,
          description: item.name,
          unit: item.unit ?? undefined,
          quantity: new Prisma.Decimal(data.quantity),
          unitPrice: new Prisma.Decimal(data.unitCost),
          lineTotal: totalCost,
          sortOrder: 0,
        },
      })

      await tx.inventoryMovement.update({
        where: { id: mov.id },
        data: { transactionId: financeTx.id },
      })

      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'INVENTORY_MOVEMENT.CREATED',
        entityType: 'InventoryMovement',
        entityId: mov.id,
        payload: { movementType: data.movementType, itemId: data.itemId },
      })

      return mov
    })

    revalidatePath('/inventory')
    revalidatePath('/inventory/movements')
    revalidatePath(`/inventory/items/${data.itemId}`)
    revalidatePath('/finance/transactions')
    if (data.projectId) revalidatePath(`/projects/${data.projectId}`)
    if (data.projectId) revalidatePath(`/projects/${data.projectId}/finance`)
    if (data.projectId) revalidatePath(`/projects/${data.projectId}/finance/transactions`)
    await notifyLowStockIfNeeded(org.orgId, data.itemId, item, org.memberId)
    return { success: true, movementId: purchaseMovement.id, duplicate: false }
  }

  if (
    data.movementType === 'ISSUE' &&
    data.projectId &&
    data.wbsNodeId
  ) {
    const movement = await prisma.$transaction(async (tx) => {
      const mov = await tx.inventoryMovement.create({
        data: {
          orgId: org.orgId,
          itemId: data.itemId,
          movementType: data.movementType,
          fromLocationId: data.fromLocationId ?? undefined,
          toLocationId: data.toLocationId ?? undefined,
          projectId: data.projectId ?? undefined,
          wbsNodeId: data.wbsNodeId ?? undefined,
          quantity: new Prisma.Decimal(data.quantity),
          unitCost: new Prisma.Decimal(data.unitCost),
          totalCost,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
          createdByOrgMemberId: org.memberId,
        },
      })

      const year = new Date().getFullYear()
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year + 1, 0, 1)
      const count = await tx.financeTransaction.count({
        where: {
          orgId: org.orgId,
          type: 'EXPENSE',
          issueDate: { gte: yearStart, lt: yearEnd },
          deleted: false,
        },
      })
      const transactionNumber = `EXP-${year}-${(count + 1).toString().padStart(3, '0')}`

      const totalAmount = Number(totalCost.toString())
      const financeTx = await tx.financeTransaction.create({
        data: {
          orgId: org.orgId,
          projectId: data.projectId,
          type: 'EXPENSE',
          status: 'POSTED',
          transactionNumber,
          issueDate: new Date(),
          currency: 'USD',
          subtotal: new Prisma.Decimal(totalAmount),
          taxTotal: new Prisma.Decimal(0),
          total: new Prisma.Decimal(totalAmount),
          amountBaseCurrency: new Prisma.Decimal(totalAmount),
          description: `Consumo inventario: ${mov.id}`,
          reference: mov.id,
          createdByOrgMemberId: org.memberId,
        },
      })

      await tx.financeLine.create({
        data: {
          orgId: org.orgId,
          transactionId: financeTx.id,
          wbsNodeId: data.wbsNodeId ?? undefined,
          description: `Consumo inventario: ${item.name}`,
          quantity: new Prisma.Decimal(data.quantity),
          unitPrice: new Prisma.Decimal(data.unitCost),
          lineTotal: totalCost,
          sortOrder: 0,
        },
      })

      await tx.inventoryMovement.update({
        where: { id: mov.id },
        data: { transactionId: financeTx.id },
      })

      await publishOutboxEvent(tx, {
        orgId: org.orgId,
        eventType: 'INVENTORY_MOVEMENT.CREATED',
        entityType: 'InventoryMovement',
        entityId: mov.id,
        payload: { movementType: data.movementType, itemId: data.itemId },
      })

      return mov
    })

    revalidatePath('/inventory')
    revalidatePath('/inventory/movements')
    revalidatePath(`/inventory/items/${data.itemId}`)
    if (data.projectId) revalidatePath(`/projects/${data.projectId}`)
    await notifyLowStockIfNeeded(org.orgId, data.itemId, item, org.memberId)
    return { success: true, movementId: movement.id, duplicate: false }
  }

  const movement = await prisma.$transaction(async (tx) => {
    const mov = await tx.inventoryMovement.create({
      data: {
        orgId: org.orgId,
        itemId: data.itemId,
        movementType: data.movementType,
        fromLocationId: data.fromLocationId || undefined,
        toLocationId: data.toLocationId || undefined,
        projectId: data.projectId || undefined,
        wbsNodeId: data.wbsNodeId || undefined,
        quantity: new Prisma.Decimal(data.quantity),
        unitCost: new Prisma.Decimal(data.unitCost),
        totalCost,
        notes: data.notes,
        idempotencyKey: data.idempotencyKey,
        createdByOrgMemberId: org.memberId,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'INVENTORY_MOVEMENT.CREATED',
      entityType: 'InventoryMovement',
      entityId: mov.id,
      payload: { movementType: data.movementType, itemId: data.itemId },
    })
    return mov
  })

  revalidatePath('/inventory')
  revalidatePath('/inventory/movements')
  revalidatePath(`/inventory/items/${data.itemId}`)
  if (data.projectId) revalidatePath(`/projects/${data.projectId}`)
  await notifyLowStockIfNeeded(org.orgId, data.itemId, item, org.memberId)
  return { success: true, movementId: movement.id, duplicate: false }
}

async function notifyLowStockIfNeeded(
  orgId: string,
  itemId: string,
  item: { name: string; minStockQty: Prisma.Decimal | null },
  actorOrgMemberId: string
) {
  if (item.minStockQty == null) return
  const total = await calculateTotalStock(itemId, orgId)
  if (total.gte(item.minStockQty)) return
  const members = await prisma.orgMember.findMany({
    where: { orgId, active: true },
    select: { userId: true },
  })
  const userIds = members.map((m) => m.userId)
  if (userIds.length === 0) return
  const actor = await prisma.orgMember.findUnique({
    where: { id: actorOrgMemberId },
    select: { userId: true },
  })
  await createInAppNotificationsForUsers(userIds, {
    orgId,
    actorUserId: actor?.userId ?? undefined,
    category: 'LOW_STOCK',
    title: 'Stock bajo',
    message: `${item.name} está por debajo del stock mínimo.`,
    metadata: { link: '/inventory' },
  })
}

export async function getItemStockByLocation(itemId: string, locationId: string) {
  try {
    const { org } = await getAuthContext()
    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId, orgId: org.orgId },
      select: { id: true },
    })
    if (!item) return { success: false as const, error: 'Item no encontrado' }
    const location = await prisma.inventoryLocation.findFirst({
      where: { id: locationId, orgId: org.orgId },
      select: { id: true },
    })
    if (!location) return { success: false as const, error: 'Ubicación no encontrada' }
    const balance = await calculateStockBalance(itemId, locationId, org.orgId)
    return { success: true as const, stock: Number(balance.toString()) }
  } catch {
    return { success: false as const, error: 'Error al obtener stock' }
  }
}

export async function getProjectWBSNodes(projectId: string) {
  try {
    const { org } = await getAuthContext()
    await assertProjectAccess(projectId, org)
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: org.orgId },
      select: { id: true },
    })
    if (!project) return { success: false as const, error: 'Proyecto no encontrado', nodes: [] }
    const nodes = await prisma.wbsNode.findMany({
      where: { projectId, orgId: org.orgId, active: true },
      select: { id: true, code: true, name: true, category: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    })
    return { success: true as const, nodes }
  } catch {
    return { success: false as const, error: 'Error al cargar partidas', nodes: [] }
  }
}
