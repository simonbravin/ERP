import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext, isRestrictedToProjects } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { listProjects } from '@/app/actions/projects'
import { getApprovedOrBaselineBudgetTotals } from '@/app/actions/budget'
import { ProjectsListClient } from '@/components/projects/projects-list-client'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Plus, FileSpreadsheet } from 'lucide-react'

const PAGE_SIZE = 25

type PageProps = {
  searchParams: Promise<{ status?: string; phase?: string; search?: string; page?: string }>
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()
  const t = await getTranslations('projects')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const result = await listProjects({
    status: params.status,
    phase: params.phase,
    search: params.search,
    page,
    pageSize: PAGE_SIZE,
  })
  const isPaginated = typeof result === 'object' && 'projects' in result && 'total' in result
  const projects = isPaginated ? result.projects : result
  const total = isPaginated ? result.total : projects.length
  const pageSize = isPaginated ? result.pageSize : projects.length
  // Single batch query for budget totals (no N+1)
  const budgetTotals = await getApprovedOrBaselineBudgetTotals(projects.map((p) => p.id))
  const projectsWithBudget = projects.map((p) => ({
    ...p,
    totalBudget: budgetTotals[p.id] ?? 0,
  }))
  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  const restrictedNoProjects = isRestrictedToProjects(org) && projects.length === 0

  if (restrictedNoProjects) {
    return (
      <div className="erp-view-container space-y-6 bg-background">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('title')}</h1>
          <p className="erp-section-desc">{t('subtitle')}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">
            {t('noAssignedProjects', { defaultMessage: 'No tenés proyectos asignados. Contactá al administrador para que te asigne al menos un proyecto.' })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="erp-header-row">
        <div className="erp-section-header">
          <h1 className="erp-page-title">{t('title')}</h1>
          <p className="erp-section-desc">{t('subtitle')}</p>
        </div>
        {canEdit && (
          <div className="erp-header-actions">
            <Button asChild variant="outline">
              <Link href="/projects/import">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t('importFromExcel', { defaultValue: 'Importar desde Excel' })}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('newProject')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Projects list/grid */}
      <ProjectsListClient
        projects={projectsWithBudget}
        canEdit={canEdit}
        showExport={true}
        total={total}
        page={page}
        pageSize={pageSize}
        searchParams={params}
      />
    </div>
  )
}
