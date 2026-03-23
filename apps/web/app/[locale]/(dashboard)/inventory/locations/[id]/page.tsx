import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { notFound } from 'next/navigation'
import { prisma } from '@repo/database'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Warehouse, Building2, MapPin, FolderGit2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { toInventoryMovementClientRows } from '@/lib/inventory-serialize'

const typeLabels: Record<string, string> = {
  CENTRAL_WAREHOUSE: 'Almacén central',
  PROJECT_SITE: 'Obra / Sitio de proyecto',
  SUPPLIER: 'Proveedor',
}

const typeIcons: Record<string, typeof Warehouse> = {
  CENTRAL_WAREHOUSE: Warehouse,
  PROJECT_SITE: Building2,
  SUPPLIER: Building2,
}

const movementTypeLabels: Record<string, string> = {
  PURCHASE: 'Compra',
  TRANSFER: 'Transferencia',
  ISSUE: 'Consumo',
  ADJUSTMENT: 'Ajuste',
}

type PageProps = {
  params: Promise<{ id: string }>
}

type LocationStatsRow = {
  id: string
  name: string
  type: string
  address: string | null
  items_count: bigint
  total_quantity: unknown
}

export default async function LocationDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { id } = await params

  const [location, statsRows, recentMovements] = await Promise.all([
    prisma.inventoryLocation.findFirst({
      where: { id, orgId: org.orgId },
      include: {
        project: { select: { id: true, name: true, projectNumber: true } },
      },
    }),
    prisma.$queryRaw<LocationStatsRow[]>`
      SELECT 
        il.id,
        il.name,
        il.type,
        il.address,
        COUNT(DISTINCT im.item_id)::bigint as items_count,
        COALESCE(SUM(
          CASE 
            WHEN im.to_location_id = il.id THEN im.quantity
            WHEN im.from_location_id = il.id THEN -im.quantity
            ELSE 0
          END
        ), 0) as total_quantity
      FROM inventory.inventory_locations il
      LEFT JOIN inventory.inventory_movements im ON (im.to_location_id = il.id OR im.from_location_id = il.id)
      WHERE il.id = ${id}
      AND il.org_id = ${org.orgId}
      GROUP BY il.id, il.name, il.type, il.address
    `,
    prisma.inventoryMovement.findMany({
      where: {
        orgId: org.orgId,
        OR: [{ fromLocationId: id }, { toLocationId: id }],
      },
      include: {
        item: { select: { id: true, name: true, sku: true, unit: true } },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        createdBy: { select: { user: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  if (!location) notFound()

  const stats = statsRows[0]
  const itemsCount = stats ? Number(stats.items_count) : 0
  const totalQty = stats ? Number(stats.total_quantity) : 0
  const Icon = typeIcons[location.type] ?? Warehouse
  const typeLabel = typeLabels[location.type] ?? location.type
  const movementsPlain = toInventoryMovementClientRows(recentMovements)

  return (
    <div className="h-full">
      <PageHeader
        title={location.name}
        subtitle={typeLabel}
        breadcrumbs={[
          { label: 'Inventario', href: '/inventory' },
          { label: 'Ubicaciones', href: '/inventory/locations' },
          { label: location.name },
        ]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/locations">← Ubicaciones</Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{location.name}</h2>
                <Badge variant="outline">{typeLabel}</Badge>
              </div>
              {location.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{location.address}</span>
                </div>
              )}
              {location.project && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <FolderGit2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <Link
                    href={`/projects/${location.project.id}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {location.project.name} ({location.project.projectNumber})
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border pt-6 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Items distintos</p>
              <p className="font-mono text-xl font-bold tabular-nums">{itemsCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cantidad total</p>
              <p className="font-mono text-xl font-bold tabular-nums">{totalQty.toFixed(0)}</p>
            </div>
          </div>
        </Card>

        {movementsPlain.length > 0 && (
          <Card className="p-6">
            <h3 className="mb-4 text-base font-semibold">Últimos movimientos</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 font-medium">Tipo</th>
                    <th className="pb-2 pr-4 font-medium">Item</th>
                    <th className="pb-2 pr-4 font-medium">Desde</th>
                    <th className="pb-2 pr-4 font-medium">Hacia</th>
                    <th className="pb-2 pr-4 text-right font-medium">Cantidad</th>
                    <th className="pb-2 font-medium">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsPlain.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {movementTypeLabels[m.movementType] ?? m.movementType}
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/inventory/items/${m.item?.id}`}
                          className="hover:text-primary font-medium"
                        >
                          {m.item?.name ?? m.itemId}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {m.fromLocation?.name ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {m.toLocation?.name ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums">
                        {typeof m.quantity === 'number'
                          ? m.quantity
                          : Number(m.quantity ?? 0)}{' '}
                        {m.item?.unit ?? ''}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {m.createdBy?.user?.fullName ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {movementsPlain.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No hay movimientos en esta ubicación.
          </p>
        )}
      </div>
    </div>
  )
}
