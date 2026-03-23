import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getResource, listSuppliers, updateResource } from '@/app/actions/resources'
import { ResourceForm } from '@/components/resources/resource-form'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditResourcePage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  if (!hasMinimumRole(org.role, 'ADMIN')) return notFound()

  const { id } = await params
  const [resource, supplierOptions] = await Promise.all([
    getResource(id),
    listSuppliers(),
  ])

  if (!resource) return notFound()

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/resources"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Resources
        </Link>
      </div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Edit resource
      </h2>
      <ResourceForm
        mode="edit"
        defaultValues={{
          code: resource.code,
          name: resource.name,
          category: resource.category as 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'SUBCONTRACT' | 'OTHER',
          description: resource.description ?? '',
          unit: resource.unit,
          unitCost: resource.unitCost,
          supplierId: resource.supplierId ?? null,
        }}
        supplierOptions={supplierOptions}
        onSubmit={(data) => updateResource(id, data)}
        onCancelHref="/resources"
      />
    </div>
  )
}
