import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { PageHeader } from '@/components/layout/page-header'
import { LocationForm } from '@/components/inventory/location-form'

export default async function NewLocationPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  requireRole(org.role, 'EDITOR')

  const projects = await prisma.project.findMany({
    where: { orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="h-full">
      <PageHeader
        title="Nueva Ubicación"
        subtitle="Registra un almacén, obra o punto de entrega"
        breadcrumbs={[
          { label: 'Inventario', href: '/inventory' },
          { label: 'Ubicaciones', href: '/inventory/locations' },
          { label: 'Nueva' },
        ]}
      />

      <div className="mx-auto max-w-5xl w-full space-y-6 p-6">
        <LocationForm projects={projects} />
      </div>
    </div>
  )
}
