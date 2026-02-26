import { notFound } from 'next/navigation'
import { redirect, Link } from '@/i18n/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProject } from '@/app/actions/projects'
import { getApprovedOrBaselineVersionId } from '@/app/actions/budget'
import { Button } from '@/components/ui/button'

type PageProps = {
  params: Promise<{ id: string; locale?: string }>
}

export default async function BudgetApprovedRedirectPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, locale } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const versionId = await getApprovedOrBaselineVersionId(projectId)
  if (versionId) {
    redirect({ href: `/projects/${projectId}/budget/${versionId}`, locale: locale ?? 'es' })
  }

  return (
    <div className="erp-stack w-full max-w-4xl">
      <p className="text-muted-foreground max-w-full text-base leading-relaxed">
        No hay presupuesto aprobado aún. Creá o aprobá una versión desde Versiones.
      </p>
      <Button asChild variant="default">
        <Link href={`/projects/${projectId}/budget`}>Ir a Versiones</Link>
      </Button>
    </div>
  )
}
