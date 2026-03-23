import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirectToLogin } from '@/lib/i18n-redirect'
import { PageHeader } from '@/components/layout/page-header'
import { ItemForm } from '@/components/inventory/item-form'
import { getInventoryCategories, getInventorySubcategories } from '@/app/actions/inventory'

export default async function NewItemPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const [categories, subcategories] = await Promise.all([
    getInventoryCategories(),
    getInventorySubcategories(),
  ])

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title="Nuevo Item de Inventario"
        subtitle="Registra un nuevo material, equipo o insumo. Después de crear el item podrás registrar compras o ajustes para dar de alta el stock."
        breadcrumbs={[
          { label: 'Inventario', href: '/inventory' },
          { label: 'Items', href: '/inventory/items' },
          { label: 'Nuevo' },
        ]}
      />
      <div className="mx-auto w-full max-w-5xl min-w-0">
        <ItemForm categories={categories} subcategories={subcategories} />
      </div>
    </div>
  )
}
