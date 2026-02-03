import { redirectToLogin } from '@/lib/i18n-redirect'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { listProjects } from '@/app/actions/projects'
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
  const canEdit = hasMinimumRole(org.role, 'EDITOR')

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('subtitle')}
          </p>
        </div>

        {/* New project and Import - only for EDITOR and above */}
        {canEdit && (
          <div className="flex gap-2">
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
      <ProjectsListClient projects={projects} canEdit={canEdit} />
    </div>
  )
}
