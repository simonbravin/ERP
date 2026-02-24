import { notFound } from 'next/navigation'
import { getProject } from '@/app/actions/projects'
import {
  getProjectOverheadBudgeted,
  getProjectOverheadConsumed,
  getProjectOverheadItems,
} from '@/app/actions/finance'
import { ProjectOverheadClient } from '@/components/finance/project-overhead-client'

interface PageProps {
  params: Promise<{ id: string; locale: string }>
}

export default async function ProjectOverheadPage({ params }: PageProps) {
  const { id: projectId } = await params

  const [project, budgeted, consumed, items] = await Promise.all([
    getProject(projectId),
    getProjectOverheadBudgeted(projectId),
    getProjectOverheadConsumed(projectId),
    getProjectOverheadItems(projectId),
  ])

  if (!project) notFound()

  return (
    <div className="space-y-6">
      <ProjectOverheadClient
        projectId={projectId}
        budgeted={budgeted}
        consumed={consumed}
        initialItems={items}
      />
    </div>
  )
}
