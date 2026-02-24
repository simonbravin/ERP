import { getSession } from '@/lib/session'
import { getOrgContext, getVisibleProjectIds } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { prisma } from '@repo/database'
import { serializeForClient } from '@/lib/utils/serialization'
import { MovementsListClient } from '@/components/inventory/movements-list-client'
import { Button } from '@/components/ui/button'
import { Plus, Download } from 'lucide-react'
import { Link } from '@/i18n/navigation'

type PageProps = {
  searchParams: Promise<{
    type?: string
    itemId?: string
    locationId?: string
    from?: string
    to?: string
  }>
}

function parseMultiParam(value: string | undefined): string[] {
  if (!value || typeof value !== 'string') return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

export default async function MovementsListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const allowedProjectIds = await getVisibleProjectIds(org)
  const params = await searchParams

  const where: Record<string, unknown> = { orgId: org.orgId }
  if (Array.isArray(allowedProjectIds)) {
    where.OR =
      allowedProjectIds.length === 0
        ? [{ projectId: null }]
        : [{ projectId: null }, { projectId: { in: allowedProjectIds } }]
  }

  const typeList = parseMultiParam(params.type)
  if (typeList.length > 0) {
    where.movementType = typeList.length === 1 ? typeList[0] : { in: typeList }
  }

  const itemIdList = parseMultiParam(params.itemId)
  if (itemIdList.length > 0) {
    where.itemId = itemIdList.length === 1 ? itemIdList[0] : { in: itemIdList }
  }

  const locationIdList = parseMultiParam(params.locationId)
  if (locationIdList.length > 0) {
    const locationFilter = [
      { fromLocationId: locationIdList.length === 1 ? locationIdList[0] : { in: locationIdList } },
      { toLocationId: locationIdList.length === 1 ? locationIdList[0] : { in: locationIdList } },
    ]
    where.AND = where.AND ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), { OR: locationFilter }] : [{ OR: locationFilter }]
  }

  if (params.from || params.to) {
    where.createdAt = {}
    if (params.from) {
      where.createdAt.gte = new Date(params.from)
    }
    if (params.to) {
      const toDate = new Date(params.to)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }

  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: {
      item: {
        select: { sku: true, name: true, unit: true },
      },
      fromLocation: {
        select: { name: true, type: true },
      },
      toLocation: {
        select: { name: true, type: true },
      },
      project: {
        select: { projectNumber: true, name: true },
      },
      wbsNode: {
        select: { code: true, name: true },
      },
      createdBy: {
        select: {
          user: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const [items, locations] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { orgId: org.orgId, active: true },
      select: { id: true, sku: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryLocation.findMany({
      where: { orgId: org.orgId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const movementsPlain = movements.map((m) => serializeForClient(m))

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="erp-section-header">
          <h1 className="erp-page-title">Movimientos de Inventario</h1>
          <p className="erp-section-desc">{movementsPlain.length} movimientos encontrados</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button asChild variant="default">
            <Link href="/inventory/movements/new">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Movimiento
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm md:p-6">
        <MovementsListClient
          movements={movementsPlain}
          items={items}
          locations={locations}
        />
      </div>
    </div>
  )
}
