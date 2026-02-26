import { notFound, unstable_rethrow } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { serializeForClient } from '@/lib/utils/serialization'
import { ProjectLayoutInner } from '@/components/projects/project-layout-inner'

type ProjectLayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

/**
 * Project-specific layout
 * - Validates project access
 * - Header: nombre + número + editar (mismo ancho que finanzas)
 * - Submenú (tabs) debajo del header, antes del contenido
 */
export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  try {
    const session = await getSession()
    if (!session?.user?.id) return notFound()

    const org = await getOrgContext(session.user.id)
    if (!org) return notFound()

    const { id } = await params

    const project = await getProject(id)
    if (!project) return notFound()

    const canEdit = hasMinimumRole(org.role, 'EDITOR')
    const projectPlain = serializeForClient(project)

    return (
      <div className="erp-view-container space-y-6 py-6">
        <ProjectLayoutInner project={projectPlain} canEdit={canEdit}>
          {children}
        </ProjectLayoutInner>
      </div>
    )
  } catch (err) {
    unstable_rethrow(err)
    return notFound()
  }
}
