import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { DocumentsPageClient } from '@/components/documents/documents-page-client'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'
import type { DocumentRow } from '@/components/documents/document-list'

export default async function DocumentsPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const [documents, projects] = await Promise.all([
    prisma.document.findMany({
      where: { orgId: org.orgId, deleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { user: { select: { fullName: true } } } },
        project: {
          select: { id: true, name: true, projectNumber: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true, fileName: true, sizeBytes: true },
        },
      },
    }),
    prisma.project.findMany({
      where: { orgId: org.orgId },
      select: { id: true, name: true, projectNumber: true },
      orderBy: { projectNumber: 'asc' },
    }),
  ])

  const canUpload = hasMinimumRole(org.role, 'EDITOR')

  return (
    <div className="erp-view-container space-y-6">
      <div className="erp-header-row">
        <h1 className="erp-page-title">Organization Documents</h1>
        {canUpload && (
          <DocumentUploadModal projectId={null} projects={projects} />
        )}
      </div>

      <DocumentsPageClient documents={documents as DocumentRow[]} />
    </div>
  )
}
