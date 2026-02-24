import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext, isRestrictedToProjects } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { listProjects } from '@/app/actions/projects'
import { getApprovedOrBaselineBudgetTotal } from '@/app/actions/budget'
import { ProjectsListClient } from '@/components/projects/projects-list-client'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Plus, FileSpreadsheet } from 'lucide-react'

type PageProps = {
  searchParams: Promise<{ status?: string; phase?: string; search?: string }>
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()
  const t = await getTranslations('projects')

  const params = await searchParams
  const projects = await listProjects({
    status: params.status,
    phase: params.phase,
    search: params.search,
  })
  // Enrich with approved/baseline budget total so list shows correct presupuesto
  const budgetTotals = await Promise.all(
    projects.map((p) => getApprovedOrBaselineBudgetTotal(p.id))
  )
  const projectsWithBudget = projects.map((p, i) => ({
    ...p,
    totalBudget:
      budgetTotals[i] > 0 ? budgetTotals[i] : (p.totalBudget ? Number(p.totalBudget) : 0),
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
      <ProjectsListClient projects={projectsWithBudget} canEdit={canEdit} showExport={true} />
    </div>
  )
}
