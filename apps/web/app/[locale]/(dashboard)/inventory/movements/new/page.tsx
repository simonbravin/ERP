import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { prisma } from '@repo/database'
import { PageHeader } from '@/components/layout/page-header'
import { MovementWizard } from '@/components/inventory/movement-wizard'

type PageProps = {
  searchParams: Promise<{ type?: string; itemId?: string }>
}

export default async function NewMovementPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const params = await searchParams

  const itemsRaw = await prisma.inventoryItem.findMany({
    where: { orgId: org.orgId, active: true },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })
  const items = itemsRaw.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit ?? '',
    sku: item.sku,
    category: item.category?.name ?? undefined,
  }))

  const locations = await prisma.inventoryLocation.findMany({
    where: { orgId: org.orgId, active: true },
    select: {
      id: true,
      name: true,
      type: true,
    },
    orderBy: { name: 'asc' },
  })

  const projects = await prisma.project.findMany({
    where: { orgId: org.orgId, active: true, status: 'ACTIVE' },
    select: {
      id: true,
      projectNumber: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  })

  const suppliers = await prisma.party.findMany({
    where: { orgId: org.orgId, partyType: 'SUPPLIER', active: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="h-full">
      <PageHeader
        title="Nuevo Movimiento de Inventario"
        subtitle="Registra compras, transferencias, consumos o ajustes"
        breadcrumbs={[
          { label: 'Inventario', href: '/inventory' },
          { label: 'Movimientos', href: '/inventory/movements' },
          { label: 'Nuevo' },
        ]}
      />

      <div className="p-6">
        <div className="mx-auto max-w-4xl">
          <MovementWizard
            items={items}
            locations={locations}
            projects={projects}
            suppliers={suppliers}
            initialType={params.type}
            initialItemId={params.itemId}
          />
        </div>
      </div>
    </div>
  )
}
