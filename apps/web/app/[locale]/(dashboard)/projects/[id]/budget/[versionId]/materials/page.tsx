import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@repo/database'
import { getConsolidatedMaterials, getMaterialsBySupplier } from '@/app/actions/materials'
import { MaterialsListClient } from '@/components/materials/materials-list-client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Package } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  params: Promise<{ locale: string; id: string; versionId: string }>
}

export default async function MaterialsListPage({ params }: PageProps) {
  const session = await getSession()
  const { locale, id: projectId, versionId } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org) redirect(`/${locale}/login`)

  const version = await prisma.budgetVersion.findFirst({
    where: {
      id: versionId,
      projectId,
      orgId: org.orgId,
    },
    select: {
      id: true,
      versionCode: true,
      status: true,
      project: { select: { name: true, projectNumber: true } },
    },
  })

  if (!version) notFound()

  if (!['BASELINE', 'APPROVED'].includes(version.status)) {
    redirect(`/${locale}/projects/${projectId}/budget/${versionId}`)
  }

  const [materials, suppliers] = await Promise.all([
    getConsolidatedMaterials(versionId),
    getMaterialsBySupplier(versionId),
  ])

  const t = await getTranslations('materials')

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href={`/projects/${projectId}/budget/${versionId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToBudget', { defaultValue: 'Volver al Presupuesto' })}
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
            <Package className="h-7 w-7 text-muted-foreground" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {version.project.name} • {version.versionCode}
          </p>
        </div>
      </div>

      <MaterialsListClient
        materials={materials}
        suppliers={suppliers}
        budgetVersionId={versionId}
        projectId={projectId}
        projectName={version.project.name}
        versionCode={version.versionCode}
      />
    </div>
  )
}
