'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { List, Grid, FileText, FolderOpen, Trash2 } from 'lucide-react'
import { DocumentList, type DocumentRow } from './document-list'
import { DocumentCard } from './document-card'
import { deleteDocumentFolder } from '@/app/actions/documents'

type FolderItem = { id: string; name: string }
type ProjectOption = { id: string; name: string; projectNumber: string }

type DocumentsPageClientProps = {
  documents: DocumentRow[]
  subfolders?: FolderItem[]
  /** Full path from root to current folder (for breadcrumb). If empty, currentFolder can still be set for legacy. */
  folderPath?: { id: string; name: string }[]
  currentFolder?: { id: string; name: string; parentId: string | null } | null
  projectId?: string | null
  projects?: ProjectOption[]
  showProjectLinks?: boolean
  /** When set (e.g. project name), breadcrumb shows this instead of "Documentos" for the root link */
  breadcrumbRootLabel?: string
  /** If true, show delete folder button (admin only) */
  canDeleteFolders?: boolean
}

export function DocumentsPageClient({
  documents,
  subfolders = [],
  folderPath = [],
  currentFolder,
  projectId,
  projects = [],
  showProjectLinks = false,
  breadcrumbRootLabel,
  canDeleteFolders = false,
}: DocumentsPageClientProps) {
  const t = useTranslations('documents')
  const tNav = useTranslations('nav')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; isCurrent: boolean } | null>(null)

  async function handleDeleteFolder(folderId: string, isCurrentFolder: boolean) {
    setDeletingId(folderId)
    try {
      await deleteDocumentFolder(folderId)
      setFolderToDelete(null)
      if (isCurrentFolder && currentFolder?.parentId) {
        router.push(`${basePath}?folderId=${currentFolder.parentId}`)
      } else {
        router.refresh()
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('deleteFolderFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  const basePath = projectId ? `/projects/${projectId}/documents` : '/documents'
  const rootLabel = breadcrumbRootLabel ?? t('backToDocuments')
  const breadcrumbSegments = folderPath.length > 0 ? folderPath : (currentFolder ? [{ id: currentFolder.id, name: currentFolder.name }] : [])

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects
    const q = projectSearch.trim().toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.projectNumber.toLowerCase().includes(q)
    )
  }, [projects, projectSearch])

  const filtered = useMemo(() => {
    if (!search.trim()) return documents
    const q = search.trim().toLowerCase()
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        (doc.description?.toLowerCase().includes(q) ?? false) ||
        (doc.category?.toLowerCase().includes(q) ?? false) ||
        (doc.project?.name.toLowerCase().includes(q) ?? false)
    )
  }, [documents, search])

  const hasContent = subfolders.length > 0 || filtered.length > 0
  const emptyList = subfolders.length === 0 && filtered.length === 0

  return (
    <div className="w-full space-y-4">
      {(breadcrumbSegments.length > 0 || currentFolder) && (
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={basePath} className="hover:text-foreground">
            {rootLabel}
          </Link>
          {breadcrumbSegments.map((seg, i) => (
            <span key={seg.id} className="flex items-center gap-2">
              <span>/</span>
              {i < breadcrumbSegments.length - 1 ? (
                <Link href={`${basePath}?folderId=${seg.id}`} className="hover:text-foreground">
                  {seg.name}
                </Link>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="text-foreground font-medium">{seg.name}</span>
                  {canDeleteFolders && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title={t('deleteFolder')}
                      disabled={!!deletingId}
                      onClick={() => setFolderToDelete({ id: seg.id, isCurrent: true })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {showProjectLinks && projects.length > 0 && !currentFolder && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{tNav('projects')}</h2>
          <div className="erp-search-row mb-3 flex-1 min-w-0">
            <div className="erp-search-input-wrap">
              <Input
                type="search"
                placeholder={t('searchProjectPlaceholder')}
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="erp-search-input"
              />
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {filteredProjects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}/documents`}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <FolderOpen className="h-4 w-4" />
                  {p.projectNumber} – {p.name}
                </Link>
              </li>
            ))}
          </ul>
          {filteredProjects.length === 0 && projectSearch.trim() && (
            <p className="mt-2 text-sm text-muted-foreground">{t('noProjectsMatch')}</p>
          )}
        </div>
      )}

      {subfolders.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t('folder')}</h2>
          <ul className="flex flex-wrap gap-2">
            {subfolders.map((f) => (
              <li key={f.id} className="inline-flex items-center gap-1">
                <Link
                  href={`${basePath}?folderId=${f.id}`}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <FolderOpen className="h-4 w-4" />
                  {f.name}
                </Link>
                {canDeleteFolders && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    title={t('deleteFolder')}
                    disabled={!!deletingId}
                    onClick={() => setFolderToDelete({ id: f.id, isCurrent: false })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="erp-search-row flex-1 min-w-0">
        <div className="erp-search-input-wrap">
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-search-input"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Vista:</span>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="h-8 px-3"
            title={t('viewTable')}
          >
            <List className="mr-1.5 h-4 w-4" />
            {t('viewTable')}
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 px-3"
            title={t('viewGrid')}
          >
            <Grid className="mr-1.5 h-4 w-4" />
            {t('viewGrid')}
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <DocumentList documents={filtered} />
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      ) : emptyList ? (
        <div className="erp-card flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {t('noDocumentsYet')}
          </p>
        </div>
      ) : null}

      <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <DialogContent className="erp-form-modal max-w-xl gap-6 py-6">
          <DialogHeader>
            <DialogTitle>{t('deleteFolder')}</DialogTitle>
            <DialogDescription className="text-foreground/80">
              {t('deleteFolderConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFolderToDelete(null)}
              disabled={!!deletingId}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!!deletingId}
              onClick={() =>
                folderToDelete && handleDeleteFolder(folderToDelete.id, folderToDelete.isCurrent)
              }
            >
              {deletingId ? t('deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
