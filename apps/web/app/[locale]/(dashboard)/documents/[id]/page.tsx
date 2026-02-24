import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { prisma } from '@repo/database'
import { DocumentVersionList } from '@/components/documents/document-version-list'
import type { DocumentVersionRow } from '@/components/documents/document-version-list'
import {
  deleteDocument,
} from '@/app/actions/documents'
import { DocumentDeleteButton } from '@/components/documents/document-delete-button'
import { getTranslations } from 'next-intl/server'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const t = await getTranslations('documents')
  const { id: docId } = await params

  const doc = await prisma.document.findFirst({
    where: { id: docId, orgId: org.orgId, deleted: false },
    include: {
      createdBy: { select: { user: { select: { fullName: true } } } },
      project: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: {
          uploadedBy: { select: { user: { select: { fullName: true } } } },
        },
      },
    },
  })

  if (!doc) notFound()

  const canUpload = hasMinimumRole(org.role, 'EDITOR')
  const canDelete = hasMinimumRole(org.role, 'ADMIN')

  const versions: DocumentVersionRow[] = doc.versions.map((v: (typeof doc.versions)[number]) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    fileName: v.fileName,
    mimeType: v.mimeType,
    sizeBytes: v.sizeBytes,
    uploadedAt: v.uploadedAt,
    uploadedBy: v.uploadedBy,
  }))

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href={doc.projectId ? `/projects/${doc.projectId}/documents` : '/documents'}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← {doc.projectId ? t('projectDocuments') : t('backToDocuments')}
        </Link>
        {doc.project && (
          <>
            <span className="text-gray-400">|</span>
            <Link
              href={`/projects/${doc.project.id}`}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              {doc.project.name}
            </Link>
          </>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {doc.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {doc.docType.replace(/_/g, ' ')}
            {doc.category && ` • ${doc.category}`}
          </p>
          {doc.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {doc.description}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {t('createdByOn', {
              name: doc.createdBy.user.fullName,
              date: new Date(doc.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }),
            })}
          </p>
        </div>
        {canDelete && (
          <DocumentDeleteButton docId={docId} redirectTo={doc.projectId ? `/projects/${doc.projectId}/documents` : '/documents'} deleteDocument={deleteDocument} />
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <DocumentVersionList
          documentId={docId}
          versions={versions}
          canUpload={canUpload}
        />
      </div>
    </div>
  )
}
