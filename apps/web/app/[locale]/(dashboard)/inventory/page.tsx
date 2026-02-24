import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { serializeForClient } from '@/lib/utils/serialization'
import { InventoryKPICards } from '@/components/inventory/inventory-kpi-cards'
import { LowStockAlerts } from '@/components/inventory/low-stock-alerts'
import { RecentMovements } from '@/components/inventory/recent-movements'
import { Button } from '@/components/ui/button'
import { Plus, Package, MapPin, FileStack } from 'lucide-react'
import { Link } from '@/i18n/navigation'

const ACTION_CARD_CLASS =
  'flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md min-w-0'

export default async function InventoryDashboardPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { orgId } = org

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [totalItems, monthMovements, itemsWithMinStock, recentMovements] = await Promise.all([
    prisma.inventoryItem.count({ where: { orgId, active: true } }),
    prisma.inventoryMovement.count({
      where: { orgId, createdAt: { gte: startOfMonth } },
    }),
    prisma.inventoryItem.findMany({
      where: { orgId, active: true, minStockQty: { not: null } },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        minStockQty: true,
        reorderQty: true,
      },
    }),
    prisma.inventoryMovement.findMany({
      where: { orgId },
      include: {
        item: { select: { id: true, sku: true, name: true, unit: true } },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        createdBy: {
          select: {
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const { calculateTotalStock } = await import('@/lib/inventory-utils')

  let criticalStock = 0
  let totalValue = 0

  const allItems = await prisma.inventoryItem.findMany({
    where: { orgId, active: true },
    select: { id: true, minStockQty: true },
  })

  for (const it of allItems) {
    const total = await calculateTotalStock(it.id, orgId)
    const totalNum = typeof total === 'number' ? total : total?.toNumber?.() ?? 0
    const minNum =
      it.minStockQty == null
        ? null
        : typeof it.minStockQty === 'number'
          ? it.minStockQty
          : it.minStockQty?.toNumber?.() ?? null
    if (minNum != null && totalNum < minNum) criticalStock++
  }

  const movementsByItem = await prisma.inventoryMovement.findMany({
    where: { orgId, movementType: 'PURCHASE' },
    select: {
      itemId: true,
      quantity: true,
      unitCost: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const lastCostByItem = new Map<string, { unitCost: number; quantity: number }>()
  for (const m of movementsByItem) {
    if (!lastCostByItem.has(m.itemId)) {
      const uc = typeof m.unitCost === 'number' ? m.unitCost : m.unitCost?.toNumber?.() ?? 0
      const q = typeof m.quantity === 'number' ? m.quantity : m.quantity?.toNumber?.() ?? 0
      lastCostByItem.set(m.itemId, { unitCost: uc, quantity: q })
    }
  }

  for (const it of allItems) {
    const total = await calculateTotalStock(it.id, orgId)
    const totalNum = typeof total === 'number' ? total : total?.toNumber?.() ?? 0
    const last = lastCostByItem.get(it.id)
    if (last) totalValue += totalNum * last.unitCost
  }

  const toNum = (v: unknown): number =>
    v == null ? 0 : typeof v === 'number' ? v : (v as { toNumber?: () => number })?.toNumber?.() ?? 0

  const lowStockRows: Array<{
    id: string
    sku: string
    name: string
    unit: string
    minStockQty: number | null
    reorderQty: number
    current_stock: number
  }> = []

  for (const item of itemsWithMinStock) {
    const total = await calculateTotalStock(item.id, orgId)
    const totalNum = toNum(total)
    const minNum =
      item.minStockQty == null
        ? null
        : typeof item.minStockQty === 'number'
          ? item.minStockQty
          : item.minStockQty?.toNumber?.() ?? null
    if (minNum != null && totalNum < minNum) {
      lowStockRows.push({
        id: item.id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        minStockQty: minNum,
        reorderQty: toNum(item.reorderQty),
        current_stock: totalNum,
      })
    }
  }

  lowStockRows.sort((a: any, b: any) => a.current_stock - (a.minStockQty ?? 0) - (b.current_stock - (b.minStockQty ?? 0)))
  const lowStockItems = lowStockRows.slice(0, 10)

  const recentMovementsPlain = recentMovements.map((m) => serializeForClient(m))

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">Inventario</h1>
          <p className="erp-section-desc">Gestión de materiales, stock y movimientos.</p>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/inventory/items" className={ACTION_CARD_CLASS}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">Ver Items</h3>
            <p className="text-sm text-muted-foreground">{totalItems} items registrados</p>
          </div>
        </Link>

        <Link href="/inventory/locations" className={ACTION_CARD_CLASS}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">Ubicaciones</h3>
            <p className="text-sm text-muted-foreground">Gestionar almacenes y obras</p>
          </div>
        </Link>

        <Link href="/inventory/movements" className={ACTION_CARD_CLASS}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
            <FileStack className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">Movimientos</h3>
            <p className="text-sm text-muted-foreground">Historial completo</p>
          </div>
        </Link>
      </div>

      <InventoryKPICards
        totalItems={totalItems}
        criticalStock={criticalStock}
        totalValue={totalValue}
        monthMovements={monthMovements}
      />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentMovements movements={recentMovementsPlain} />
        </div>
        <div className="lg:col-span-1">
          <LowStockAlerts items={lowStockItems} />
        </div>
      </div>
    </div>
  )
}
