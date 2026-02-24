import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProject } from '@/app/actions/projects'
import { getCommitmentById } from '@/app/actions/materials'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { CommitmentDetailView } from '@/components/finance/commitment-detail-view'

interface PageProps {
  params: Promise<{ id: string; commitmentId: string; locale?: string }>
}

export default async function CommitmentDetailPage({ params }: PageProps) {
  const { id: projectId, commitmentId } = await params

  const [project, commitment] = await Promise.all([
    getProject(projectId),
    getCommitmentById(commitmentId),
  ])

  if (!project) notFound()
  if (!commitment || commitment.projectId !== projectId) notFound()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}/finance/purchase-orders`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Órdenes de compra
          </Link>
        </Button>
      </div>
      <CommitmentDetailView commitment={commitment} />
    </div>
  )
}
