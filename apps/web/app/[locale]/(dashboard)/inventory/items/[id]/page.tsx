import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { notFound } from 'next/navigation'
import { prisma } from '@repo/database'
import { serializeForClient } from '@/lib/utils/serialization'
import { toInventoryMovementClientRows } from '@/lib/inventory-serialize'
import { PageHeader } from '@/components/layout/page-header'
import { ItemDetailInfo } from '@/components/inventory/item-detail-info'
import { ItemStockByLocation } from '@/components/inventory/item-stock-by-location'
import { ItemMovementsHistory } from '@/components/inventory/item-movements-history'
import { Button } from '@/components/ui/button'
import { Edit, ShoppingCart, ArrowRightLeft, Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { calculateTotalStock, getStockByLocation } from '@/lib/inventory-utils'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ItemDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { id } = await params

  const item = await prisma.inventoryItem.findFirst({
    where: { id, orgId: org.orgId },
    include: { category: { select: { id: true, name: true } }, subcategory: { select: { id: true, name: true } } },
  })
  if (!item) notFound()

  const [totalStock, stockByLocationRaw, lastPurchase, movements] = await Promise.all([
    calculateTotalStock(id, org.orgId),
    getStockByLocation(id, org.orgId),
    prisma.inventoryMovement.findFirst({
      where: { itemId: id, orgId: org.orgId, movementType: 'PURCHASE' },
      orderBy: { createdAt: 'desc' },
      select: { unitCost: true },
    }),
    prisma.inventoryMovement.findMany({
      where: { itemId: id, orgId: org.orgId },
      include: {
        fromLocation: { select: { name: true, type: true } },
        toLocation: { select: { name: true, type: true } },
        project: { select: { name: true, projectNumber: true } },
        wbsNode: { select: { code: true, name: true } },
        createdBy: {
          select: {
            user: { select: { fullName: true } },
          },
        },
        item: { select: { id: true, sku: true, name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const currentStock = Number(totalStock.toString())
  const stockByLocation = stockByLocationRaw.map((s: { location: { id: string; name: string; type: string }; balance: { toString(): string } }) => ({
    id: s.location.id,
    name: s.location.name,
    type: s.location.type,
    stock: Number(s.balance.toString()),
  }))

  const itemPlain = serializeForClient(item)
  const itemWithStock = {
    ...itemPlain,
    current_stock: currentStock,
    last_purchase_cost: lastPurchase?.unitCost != null ? Number(lastPurchase.unitCost.toString()) : null,
  }
  const movementsPlain = toInventoryMovementClientRows(movements)

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title={item.name}
        subtitle={`SKU: ${item.sku}`}
        breadcrumbs={[
          { label: 'Inventario', href: '/inventory' },
          { label: 'Items', href: '/inventory/items' },
          { label: item.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/inventory/items/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href={`/inventory/movements/new?type=PURCHASE&itemId=${id}`}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Comprar
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href={`/inventory/movements/new?type=TRANSFER&itemId=${id}`}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transferir
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm">
              <Link href={`/inventory/movements/new?type=ADJUSTMENT&itemId=${id}`}>
                <Plus className="mr-2 h-4 w-4" />
                Ajustar
              </Link>
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <ItemDetailInfo item={itemWithStock} />

        <ItemStockByLocation
          stockByLocation={stockByLocation}
          totalStock={currentStock}
          unit={item.unit}
        />

        <ItemMovementsHistory movements={movementsPlain} unit={item.unit} />
      </div>
    </div>
  )
}
