import { getSession } from '@/lib/session'
import { getOrgContext, getVisibleProjectIds } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { prisma } from '@repo/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Warehouse, Building2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'

const typeLabels: Record<string, string> = {
  CENTRAL_WAREHOUSE: 'Almacén',
  PROJECT_SITE: 'Obra',
  SUPPLIER: 'Proveedor',
}

const typeIcons: Record<string, typeof Warehouse> = {
  CENTRAL_WAREHOUSE: Warehouse,
  PROJECT_SITE: Building2,
  SUPPLIER: Building2,
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return (v as { toNumber?: () => number })?.toNumber?.() ?? 0
}

export default async function LocationsPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const allowedProjectIds = await getVisibleProjectIds(org)

  const baseWhere = { orgId: org.orgId, active: true }
  const projectFilter = !Array.isArray(allowedProjectIds)
    ? {}
    : allowedProjectIds.length === 0
      ? { projectId: null }
      : { OR: [{ projectId: null }, { projectId: { in: allowedProjectIds } }] }

  const locations = await prisma.inventoryLocation.findMany({
    where: { ...baseWhere, ...projectFilter },
    select: { id: true, name: true, type: true, address: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  const locationIds = locations.map((l) => l.id)

  const movements =
    locationIds.length === 0
      ? []
      : await prisma.inventoryMovement.findMany({
          where: {
            orgId: org.orgId,
            OR: [{ fromLocationId: { in: locationIds } }, { toLocationId: { in: locationIds } }],
          },
          select: {
            itemId: true,
            quantity: true,
            fromLocationId: true,
            toLocationId: true,
          },
        })

  const itemsCountByLocation = new Map<string, Set<string>>()
  const totalQtyByLocation = new Map<string, number>()
  for (const id of locationIds) {
    itemsCountByLocation.set(id, new Set())
    totalQtyByLocation.set(id, 0)
  }
  for (const m of movements) {
    const q = toNum(m.quantity)
    if (m.toLocationId && totalQtyByLocation.has(m.toLocationId)) {
      totalQtyByLocation.set(m.toLocationId, totalQtyByLocation.get(m.toLocationId)! + q)
      itemsCountByLocation.get(m.toLocationId)!.add(m.itemId)
    }
    if (m.fromLocationId && totalQtyByLocation.has(m.fromLocationId)) {
      totalQtyByLocation.set(m.fromLocationId, totalQtyByLocation.get(m.fromLocationId)! - q)
      itemsCountByLocation.get(m.fromLocationId)!.add(m.itemId)
    }
  }

  const locationsWithStats = locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    type: loc.type,
    address: loc.address,
    items_count: itemsCountByLocation.get(loc.id)?.size ?? 0,
    total_quantity: totalQtyByLocation.get(loc.id) ?? 0,
  }))

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">Ubicaciones de Inventario</h1>
          <p className="erp-section-desc">Gestiona almacenes, obras y puntos de stock</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="default">
            <Link href="/inventory/locations/new">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Ubicación
            </Link>
          </Button>
        </div>
      </div>

      {locationsWithStats.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
          No hay ubicaciones. Crea un almacén u obra para comenzar.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locationsWithStats.map((location) => {
            const Icon = typeIcons[location.type] ?? Warehouse
            const typeLabel = typeLabels[location.type] ?? location.type

            return (
              <div
                key={location.id}
                className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{location.name}</h3>
                      <Badge variant="outline" className="mt-1">
                        {typeLabel}
                      </Badge>
                    </div>
                  </div>
                </div>

                {location.address && (
                  <p className="mt-3 text-sm text-muted-foreground">{location.address}</p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Items distintos</p>
                    <p className="font-mono text-lg font-bold tabular-nums">{location.items_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cantidad total</p>
                    <p className="font-mono text-lg font-bold tabular-nums">
                      {Number(location.total_quantity).toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/inventory/locations/${location.id}`}>Ver detalle</Link>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
