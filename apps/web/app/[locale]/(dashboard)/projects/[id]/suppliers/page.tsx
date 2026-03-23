import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, FileText, Receipt } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { listBudgetVersions } from '@/app/actions/budget'
import { getMaterialsBySupplier } from '@/app/actions/materials'
import { ProjectSuppliersListClient } from '@/components/suppliers/project-suppliers-list-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectSuppliersPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const t = await getTranslations('suppliers')
  const tNav = await getTranslations('nav')
  const { id: projectId } = await params

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
  })

  if (!project) return redirectTo('/projects')

  const [transactionsWithParty, budgetVersions] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: {
        projectId,
        orgId: org.orgId,
        deleted: false,
        partyId: { not: null },
        type: { in: ['PURCHASE', 'EXPENSE'] },
      },
      select: {
        partyId: true,
        party: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
          },
        },
      },
    }),
    listBudgetVersions(projectId),
  ])

  const uniqueParties = Array.from(
    new Map(
      transactionsWithParty
        .filter((tx) => tx.party != null)
        .map((tx) => [tx.party!.id, tx.party!])
    ).values()
  )

  let budgetSupplierNames: string[] = []
  const activeVersion = budgetVersions?.find(
    (v) => v.status === 'APPROVED' || v.status === 'WORKING'
  ) ?? budgetVersions?.[0]
  if (activeVersion?.id) {
    try {
      const bySupplier = await getMaterialsBySupplier(activeVersion.id)
      budgetSupplierNames = bySupplier.map((s) => s.supplierName)
    } catch {
      budgetSupplierNames = []
    }
  }

  const allSupplierNames = Array.from(
    new Set([...uniqueParties.map((p) => p.name), ...budgetSupplierNames])
  ).sort()

  const listItems = allSupplierNames.map((name) => {
    const party = uniqueParties.find((p) => p.name === name)
    return {
      name,
      email: party?.email ?? null,
      phone: party?.phone ?? null,
      city: party?.city ?? null,
    }
  })

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <PageHeader
        variant="embedded"
        title={tNav('projectSuppliers')}
        subtitle={`${project.name}${project.projectNumber ? ` • ${project.projectNumber}` : ''}`}
        breadcrumbs={[
          { label: tNav('projects'), href: '/projects' },
          { label: project.name ?? project.projectNumber ?? projectId, href: `/projects/${projectId}` },
          { label: tNav('projectSuppliers') },
        ]}
      />
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('title')}</p>
                <p className="text-2xl font-semibold tabular-nums">{allSupplierNames.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('linked')}</p>
                <p className="text-2xl font-semibold tabular-nums">{uniqueParties.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">En presupuesto</p>
                <p className="text-2xl font-semibold tabular-nums">{budgetSupplierNames.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">{tNav('projectSuppliers')}</h3>
            <ProjectSuppliersListClient items={listItems} />
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/projects/${projectId}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {tNav('overview')}
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/suppliers/list" className="text-primary hover:underline">
            {t('viewSuppliers')}
          </Link>
        </div>
      </div>
    </div>
  )
}
