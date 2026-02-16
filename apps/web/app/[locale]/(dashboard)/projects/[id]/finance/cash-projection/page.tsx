import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import { getProjectCashProjection } from '@/app/actions/finance'
import { CashProjectionClient } from '@/components/finance/cash-projection-client'

interface PageProps {
  params: Promise<{ id: string; locale: string }>
}

export default async function ProjectCashProjectionPage({ params }: PageProps) {
  const { id: projectId } = await params

  const [project, initialProjection] = await Promise.all([
    getProject(projectId),
    getProjectCashProjection(projectId, new Date()),
  ])

  if (!project) notFound()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Proyección de caja</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Capital proyectado del proyecto {project.name} a una fecha
        </p>
      </div>

      <CashProjectionClient
        initialProjection={initialProjection}
        projectId={projectId}
        title="Proyección de caja (proyecto)"
      />
    </div>
  )
}
