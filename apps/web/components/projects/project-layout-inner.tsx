'use client'

import { usePathname } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { ProjectTabsWrapper } from '@/components/projects/project-tabs-wrapper'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { Pencil } from 'lucide-react'

type ProjectLayoutInnerProps = {
  project: { id: string; name: string; projectNumber: string; status: string }
  canEdit: boolean
  children: React.ReactNode
}

/**
 * On budget version page (/projects/[id]/budget/[versionId] or /.../materials)
 * we render only children so the page shows its own header (Volver a Versiones, etc.)
 * and the project tabs are rendered inside the page below "Creado por...".
 * On other project pages we show the project header + tabs + children.
 */
export function ProjectLayoutInner({ project, canEdit, children }: ProjectLayoutInnerProps) {
  const pathname = usePathname() ?? ''
  const isBudgetVersionPage = /\/projects\/[^/]+\/budget\/[^/]+/.test(pathname)
  const isDocumentsPage = /\/projects\/[^/]+\/documents/.test(pathname)
  const t = useTranslations('projects')

  if (isBudgetVersionPage || isDocumentsPage) {
    return <>{children}</>
  }

  return (
    <>
      <div className="erp-header-row">
        <div className="erp-section-header">
          <div className="flex items-center gap-3">
            <h1 className="erp-page-title">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="mt-1 erp-section-desc">{project.projectNumber}</p>
        </div>
        <div className="erp-header-actions">
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/projects/${project.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('edit')}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <ProjectTabsWrapper projectId={project.id} />
      {children}
    </>
  )
}
