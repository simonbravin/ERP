import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import { getProjectPurchaseOrders } from '@/app/actions/materials'
import { getFinanceFilterOptions } from '@/app/actions/finance'
import { PurchaseOrdersListClient } from '@/components/finance/purchase-orders-list-client'

interface PageProps {
  params: Promise<{ id: string; locale: string }>
}

export default async function ProjectPurchaseOrdersPage({ params }: PageProps) {
  const { id: projectId } = await params

  const [project, items, filterOptions] = await Promise.all([
    getProject(projectId),
    getProjectPurchaseOrders(projectId),
    getFinanceFilterOptions(),
  ])

  if (!project) notFound()

  const parties = filterOptions?.parties?.filter((p) => p.partyType === 'SUPPLIER') ?? []

  return (
    <div className="space-y-6">
      <PurchaseOrdersListClient
        initialItems={items}
        projectId={projectId}
        parties={parties}
      />
    </div>
  )
}
