import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { ProjectForm } from '@/components/projects/project-form'
import type { UpdateProjectInput } from '@repo/validators'

type PageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function ProjectEditPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  if (!hasMinimumRole(org.role, 'EDITOR')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">
            You do not have permission to edit projects.
          </p>
        </div>
      </div>
    )
  }

  const { id } = await params
  const project = await getProject(id)
  if (!project) notFound()

  const defaultValues: UpdateProjectInput = {
    name: project.name,
    clientName: project.clientName ?? undefined,
    description: project.description ?? undefined,
    location: project.location ?? undefined,
    m2: project.m2 ? Number(project.m2) : undefined,
    status: project.status,
    phase: (project.phase ?? 'PRE_CONSTRUCTION') as UpdateProjectInput['phase'],
    startDate: project.startDate
      ? (project.startDate instanceof Date
          ? project.startDate.toISOString().slice(0, 10)
          : new Date(project.startDate).toISOString().slice(0, 10))
      : undefined,
    plannedEndDate: project.plannedEndDate
      ? (project.plannedEndDate instanceof Date
          ? project.plannedEndDate.toISOString().slice(0, 10)
          : new Date(project.plannedEndDate).toISOString().slice(0, 10))
      : undefined,
    active: project.active,
  }

  return (
    <div className="erp-stack">
      <div className="erp-card-elevated p-6">
        <h2 className="erp-section-title mb-1">Editar proyecto</h2>
        <p className="erp-section-desc mb-6">{project.projectNumber}</p>
        <ProjectForm
          mode="edit"
          projectId={id}
          defaultValues={defaultValues}
          onCancelHref={`/projects/${id}`}
        />
      </div>
    </div>
  )
}
