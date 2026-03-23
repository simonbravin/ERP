import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { notFound } from 'next/navigation'
import { prisma } from '@repo/database'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Package, Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { toInventoryMovementClientRows } from '@/lib/inventory-serialize'

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

const movementTypeLabels: Record<string, string> = {
  PURCHASE: 'Compra',
  TRANSFER: 'Transferencia',
  ISSUE: 'Consumo',
  ADJUSTMENT: 'Ajuste',
}

export default async function ProjectInventoryPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const { id: projectId } = await params

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
  })
  if (!project) notFound()

  const projectLocations = await prisma.inventoryLocation.findMany({
    where: { projectId, orgId: org.orgId, type: 'PROJECT_SITE', active: true },
    select: { id: true, name: true, address: true },
    orderBy: { name: 'asc' },
  })

  let locationsWithStats: LocationStatsRow[] = projectLocations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    type: 'PROJECT_SITE',
    address: loc.address,
    items_count: BigInt(0),
    total_quantity: 0,
  }))
  try {
    locationsWithStats = await prisma.$queryRaw<LocationStatsRow[]>`
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
      WHERE il.project_id = ${projectId}
      AND il.org_id = ${org.orgId}
      AND il.active = true
      GROUP BY il.id, il.name, il.type, il.address
      ORDER BY il.name
    `
  } catch (rawError) {
    console.error('[ProjectInventoryPage] Raw stats query failed, using fallback:', rawError)
    // locationsWithStats already holds the zeroed fallback from initializer above
  }

  const recentMovements =
    projectLocations.length > 0
      ? await prisma.inventoryMovement.findMany({
          where: {
            orgId: org.orgId,
            OR: [
              { fromLocationId: { in: projectLocations.map((l) => l.id) } },
              { toLocationId: { in: projectLocations.map((l) => l.id) } },
            ],
          },
          include: {
            item: { select: { id: true, name: true, sku: true, unit: true } },
            fromLocation: { select: { name: true } },
            toLocation: { select: { name: true } },
            createdBy: { select: { user: { select: { fullName: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
      : []

  const movementsPlain = toInventoryMovementClientRows(recentMovements)
  const statsByLocId = new Map(
    locationsWithStats.map((row) => [
      row.id,
      { itemsCount: Number(row.items_count), totalQty: Number(row.total_quantity) },
    ])
  )

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title="Inventario del Proyecto"
        subtitle={`Stock en ubicaciones de ${project.name}`}
        breadcrumbs={[
          { label: 'Proyectos', href: '/projects' },
          { label: project.name, href: `/projects/${projectId}` },
          { label: 'Inventario' },
        ]}
        actions={
          <Button asChild variant="default" size="sm">
            <Link href={`/inventory/movements/new?projectId=${projectId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Movimiento
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        {projectLocations.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Sin ubicaciones en este proyecto</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea una ubicación tipo &quot;Obra / Sitio de proyecto&quot; asociada a este proyecto
              para registrar inventario aquí.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/inventory/locations/new">Ir a Ubicaciones</Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projectLocations.map((loc) => {
                const stats = statsByLocId.get(loc.id) ?? { itemsCount: 0, totalQty: 0 }
                return (
                  <Card key={loc.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-3">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{loc.name}</h3>
                          <Badge variant="outline" className="mt-1">
                            Obra
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {loc.address && (
                      <p className="mt-3 text-sm text-muted-foreground">{loc.address}</p>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Items distintos</p>
                        <p className="font-mono text-lg font-bold tabular-nums">
                          {stats.itemsCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cantidad total</p>
                        <p className="font-mono text-lg font-bold tabular-nums">
                          {stats.totalQty.toFixed(0)}
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="mt-4 w-full">
                      <Link href={`/inventory/locations/${loc.id}`}>Ver detalle</Link>
                    </Button>
                  </Card>
                )
              })}
            </div>

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

            {projectLocations.length > 0 && movementsPlain.length === 0 && (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No hay movimientos en las ubicaciones de este proyecto.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
