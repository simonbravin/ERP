'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileUploader } from './file-uploader'
import { createDocument } from '@/app/actions/documents'
import { toast } from 'sonner'

const DOC_TYPES = [
  'CONTRACT',
  'DRAWING',
  'SPEC',
  'PHOTO',
  'REPORT',
  'INVOICE',
  'CERTIFICATE',
  'OTHER',
] as const

type ProjectOption = { id: string; name: string; projectNumber: string }

type DocumentUploadModalProps = {
  projectId: string | null
  projects?: ProjectOption[]
  folderId?: string
}

function fileNameWithoutExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot <= 0) return fileName
  return fileName.slice(0, lastDot).trim() || fileName
}

export function DocumentUploadModal({ projectId, projects = [], folderId }: DocumentUploadModalProps) {
  const router = useRouter()
  const t = useTranslations('documents')
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [title, setTitle] = useState('')

  const showProjectSelect = projectId === null && projects.length > 0

  function handleFileChange(file: File | null) {
    if (file) {
      setTitle(fileNameWithoutExtension(file.name))
    } else {
      setTitle('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsUploading(true)

    const formData = new FormData(e.currentTarget)
    const file = formData.get('file') as File | null
    const finalTitle = title.trim() || (file?.name ? fileNameWithoutExtension(file.name) : '')
    formData.set('title', finalTitle || 'Documento')
    if (projectId) {
      formData.set('projectId', projectId)
    }
    if (folderId) {
      formData.set('folderId', folderId)
    }

    try {
      await createDocument(formData)
      setIsOpen(false)
      setTitle('')
      router.refresh()
      toast.success(t('uploadDocument'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('uploadFailed'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        {t('uploadDocument')}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="erp-form-modal rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-8 text-xl font-semibold text-slate-900 dark:text-white">
              {t('uploadDocument')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="erp-form-group">
                <FileUploader name="file" required onChange={handleFileChange} />
              </div>

              <div className="erp-form-group">
                <Label htmlFor="title" className="erp-form-label">{t('titleLabel')}</Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full"
                  placeholder={t('documentTitlePlaceholder')}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Se completa con el nombre del archivo; podés editarlo.
                </p>
              </div>

              <div className="erp-form-group">
                <Label htmlFor="docType" className="erp-form-label">{t('typeLabel')}</Label>
                <select
                  id="docType"
                  name="docType"
                  required
                  defaultValue="OTHER"
                  className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  {DOC_TYPES.map((docType) => (
                    <option key={docType} value={docType}>
                      {docType.charAt(0) + docType.slice(1).toLowerCase().replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {showProjectSelect && (
                <div className="erp-form-group">
                  <Label htmlFor="projectId" className="erp-form-label">
                    {t('projectOptional')}
                  </Label>
                  <select
                    id="projectId"
                    name="projectId"
                    className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">{t('noneOrgDocument')}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectNumber} – {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="erp-form-group">
                <Label htmlFor="category" className="erp-form-label">{t('categoryOptional')}</Label>
                <Input
                  id="category"
                  name="category"
                  type="text"
                  className="mt-1 w-full"
                  placeholder={t('categoryPlaceholder')}
                />
              </div>

              <div className="erp-form-group">
                <Label htmlFor="description" className="erp-form-label">{t('descriptionOptional')}</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  className="mt-1 block w-full min-w-0 resize-y rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder={t('descriptionPlaceholder')}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? t('uploading') : t('uploadButton')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
