import { redirectToLogin, redirectTo } from '@/lib/i18n-redirect'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { listFolderContents } from '@/app/actions/documents'
import { DocumentsPageClient } from '@/components/documents/documents-page-client'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'
import { CreateFolderButton } from '@/components/documents/create-folder-button'
import { StorageUsageBar } from '@/components/documents/storage-usage-bar'
import type { DocumentRow } from '@/components/documents/document-list'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ folderId?: string }>
}

export default async function ProjectDocumentsPage({ params, searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const t = await getTranslations('documents')
  const { id: projectId } = await params
  const { folderId } = await searchParams

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: org.orgId },
    select: { id: true, name: true, projectNumber: true },
  })

  if (!project) return redirectTo('/projects')

  const { folderId: effectiveFolderId, currentFolder, folderPath, subfolders, documents } =
    await listFolderContents(folderId ?? null, projectId)

  const canUpload = hasMinimumRole(org.role, 'EDITOR')
  const canDeleteFolders = hasMinimumRole(org.role, 'ADMIN')

  return (
    <div className="erp-view-container space-y-6 p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← {project.name}
        </Link>
      </div>

      <div className="erp-header-row flex flex-wrap items-center gap-3">
        <div>
          <h1 className="erp-page-title">{t('projectDocuments')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.name} ({project.projectNumber})
          </p>
        </div>
        {canUpload && (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <CreateFolderButton parentId={effectiveFolderId ?? undefined} projectId={projectId} />
            <DocumentUploadModal projectId={projectId} folderId={effectiveFolderId ?? undefined} />
          </div>
        )}
      </div>
      <StorageUsageBar projectId={projectId} />

      <DocumentsPageClient
        documents={documents as DocumentRow[]}
        subfolders={subfolders}
        folderPath={folderPath}
        currentFolder={currentFolder}
        projectId={projectId}
        showProjectLinks={false}
        breadcrumbRootLabel={project.name}
        canDeleteFolders={canDeleteFolders}
      />
    </div>
  )
}
