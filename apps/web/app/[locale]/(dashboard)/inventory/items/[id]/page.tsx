import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { notFound } from 'next/navigation'
import { prisma } from '@repo/database'
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

  const itemWithStock = {
    ...item,
    current_stock: currentStock,
    last_purchase_cost: lastPurchase?.unitCost ?? null,
  }

  return (
    <div className="h-full">
      <PageHeader
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

            <Button variant="outline" size="sm">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Comprar
            </Button>

            <Button variant="outline" size="sm">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transferir
            </Button>

            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Ajustar
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <ItemDetailInfo item={itemWithStock} />

        <ItemStockByLocation
          stockByLocation={stockByLocation}
          totalStock={currentStock}
          unit={item.unit}
        />

        <ItemMovementsHistory movements={movements} unit={item.unit} />
      </div>
    </div>
  )
}
