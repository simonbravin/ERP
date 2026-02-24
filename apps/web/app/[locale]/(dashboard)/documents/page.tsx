import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { listProjects } from '@/app/actions/projects'
import { listFolderContents } from '@/app/actions/documents'
import { DocumentsPageClient } from '@/components/documents/documents-page-client'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'
import { CreateFolderButton } from '@/components/documents/create-folder-button'
import { StorageUsageBar } from '@/components/documents/storage-usage-bar'
import type { DocumentRow } from '@/components/documents/document-list'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  searchParams: Promise<{ folderId?: string }>
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const t = await getTranslations('documents')
  const { folderId } = await searchParams

  const { folderId: effectiveFolderId, currentFolder, folderPath, subfolders, documents } =
    await listFolderContents(folderId ?? null, null)
  const projectsList = await listProjects()
  const projects = projectsList.map((p) => ({
    id: p.id,
    name: p.name,
    projectNumber: p.projectNumber,
  }))

  const canUpload = hasMinimumRole(org.role, 'EDITOR')
  const canDeleteFolders = hasMinimumRole(org.role, 'ADMIN')

  return (
    <div className="erp-view-container space-y-6">
      <div className="erp-header-row flex flex-wrap items-center gap-3">
        <h1 className="erp-page-title">{t('titleOrg')}</h1>
        {canUpload && (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <CreateFolderButton parentId={effectiveFolderId ?? undefined} projectId={undefined} />
            <DocumentUploadModal projectId={null} projects={projects} folderId={effectiveFolderId ?? undefined} />
          </div>
        )}
      </div>
      <StorageUsageBar projectId={null} />

      <DocumentsPageClient
        documents={documents as DocumentRow[]}
        subfolders={subfolders}
        folderPath={folderPath}
        currentFolder={currentFolder}
        projectId={null}
        projects={projects}
        showProjectLinks
        canDeleteFolders={canDeleteFolders}
      />
    </div>
  )
}
