import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { serializeForClient } from '@/lib/utils/serialization'
import { ItemsListClient } from '@/components/inventory/items-list-client'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'

export default async function InventoryItemsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; stock?: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { orgId } = org
  const params = await searchParams

  const where: {
    orgId: string
    active: boolean
    OR?: Array<{ sku?: { contains: string; mode: 'insensitive' }; name?: { contains: string; mode: 'insensitive' } }>
    categoryId?: string
  } = {
    orgId,
    active: true,
  }

  if (params.q?.trim()) {
    const q = params.q.trim()
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (params.category?.trim()) {
    where.categoryId = params.category.trim()
  }

  const [items, movements, categories] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true } }, subcategory: { select: { id: true, name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { orgId },
      select: {
        itemId: true,
        movementType: true,
        fromLocationId: true,
        toLocationId: true,
        quantity: true,
        unitCost: true,
        createdAt: true,
      },
    }),
    prisma.inventoryCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const itemIds = items.map((i: any) => i.id)
  const movementsByItem = movements.filter((m: any) => itemIds.includes(m.itemId))

  const currentStockByItem = new Map<string, number>()
  const lastPurchaseByItem = new Map<string, { unitCost: number; createdAt: Date }>()

  for (const itemId of itemIds) {
    currentStockByItem.set(itemId, 0)
  }

  for (const m of movementsByItem) {
    const q = typeof m.quantity === 'number' ? m.quantity : m.quantity?.toNumber?.() ?? 0
    let current = currentStockByItem.get(m.itemId) ?? 0
    if (m.toLocationId) current += q
    if (m.fromLocationId) current -= q
    currentStockByItem.set(m.itemId, current)
  }

  for (const m of movementsByItem) {
    if (m.movementType !== 'PURCHASE') continue
    const existing = lastPurchaseByItem.get(m.itemId)
    if (!existing || m.createdAt > existing.createdAt) {
      const unitCost = typeof m.unitCost === 'number' ? m.unitCost : m.unitCost?.toNumber?.() ?? 0
      lastPurchaseByItem.set(m.itemId, { unitCost, createdAt: m.createdAt })
    }
  }

  const lastMovementByItem = new Map<string, Date>()
  for (const m of movementsByItem) {
    const existing = lastMovementByItem.get(m.itemId)
    if (!existing || m.createdAt > existing) {
      lastMovementByItem.set(m.itemId, m.createdAt)
    }
  }

  type ItemWithComputed = (typeof items)[0] & {
    current_stock: number
    last_purchase_cost: number | null
    last_movement_date: Date | null
  }

  const itemsWithComputed: ItemWithComputed[] = items.map((item: any) => ({
    ...item,
    current_stock: currentStockByItem.get(item.id) ?? 0,
    last_purchase_cost: lastPurchaseByItem.get(item.id)?.unitCost ?? null,
    last_movement_date: lastMovementByItem.get(item.id) ?? null,
  }))

  let filteredItems = itemsWithComputed
  if (params.stock === 'low') {
    filteredItems = itemsWithComputed.filter(
      (item: any) => item.minStockQty != null && item.current_stock < (typeof item.minStockQty === 'number' ? item.minStockQty : item.minStockQty?.toNumber?.() ?? 0)
    )
  } else if (params.stock === 'zero') {
    filteredItems = itemsWithComputed.filter((item: any) => item.current_stock === 0)
  } else if (params.stock === 'ok') {
    filteredItems = itemsWithComputed.filter((item: any) => {
      if (item.minStockQty == null) return true
      const min = typeof item.minStockQty === 'number' ? item.minStockQty : item.minStockQty?.toNumber?.() ?? 0
      return item.current_stock >= min
    })
  }

  const categoryOptions = categories.map((c: any) => ({ id: c.id, name: c.name }))

  const itemsPlain = filteredItems.map((item: any) => serializeForClient(item))

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">Items de Inventario</h1>
          <p className="erp-section-desc">{itemsPlain.length} items encontrados</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/movements/new">Nuevo Movimiento</Link>
          </Button>
          <Button asChild variant="default">
            <Link href="/inventory/items/new">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Item
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <ItemsListClient items={itemsPlain} categories={categoryOptions} />
      </div>
    </div>
  )
}
