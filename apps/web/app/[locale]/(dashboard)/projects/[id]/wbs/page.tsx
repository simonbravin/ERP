import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { WbsEditor } from '@/components/wbs/wbs-editor'
import type { WbsEditorNode } from '@/components/wbs/wbs-editor'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  params: Promise<{ id: string; locale: string }>
}

export default async function WbsPage({ params }: PageProps) {
  const session = await getSession()
  const { id: projectId, locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org) redirect(`/${locale}/login`)

  const t = await getTranslations('wbs')

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
  })

  if (!project) notFound()

  const rawNodes = await prisma.wbsNode.findMany({
    where: { projectId, orgId: org.orgId, active: true },
    orderBy: { code: 'asc' },
  })

  const nodes: WbsEditorNode[] = rawNodes.map((n) => ({
    id: n.id,
    code: n.code,
    name: n.name,
    category: n.category,
    parentId: n.parentId,
    unit: n.unit ?? 'un',
    quantity: n.quantity != null ? Number(n.quantity) : 0,
    description: n.description,
    sortOrder: n.sortOrder,
  }))

  const canEdit = ['EDITOR', 'ADMIN', 'OWNER'].includes(org.role)

  return (
    <div className="erp-view-container space-y-6">
      <div className="erp-section-header">
        <h1 className="erp-page-title">{t('title')}</h1>
        <p className="erp-section-desc">
          {project.name} ({project.projectNumber})
        </p>
      </div>

      <WbsEditor
        nodes={nodes}
        projectId={projectId}
        canEdit={canEdit}
      />
    </div>
  )
}
