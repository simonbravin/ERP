'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileUploader } from './file-uploader'
import { createDocument } from '@/app/actions/documents'
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
}

export function DocumentUploadModal({ projectId, projects = [] }: DocumentUploadModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const showProjectSelect = projectId === null && projects.length > 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsUploading(true)

    const formData = new FormData(e.currentTarget)
    if (projectId) {
      formData.set('projectId', projectId)
    }

    try {
      await createDocument(formData)
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        Upload Document
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="erp-form-modal rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
            <h2 className="mb-8 text-xl font-semibold text-slate-900">
              Upload Document
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="erp-form-group">
                <Label htmlFor="title" className="erp-form-label">Title</Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  required
                  className="mt-1 w-full"
                  placeholder="Document title"
                />
              </div>

              <div className="erp-form-group">
                <Label htmlFor="docType" className="erp-form-label">Type</Label>
                <select
                  id="docType"
                  name="docType"
                  required
                  className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {showProjectSelect && (
                <div className="erp-form-group">
                  <Label htmlFor="projectId" className="erp-form-label">
                    Project (optional)
                  </Label>
                  <select
                    id="projectId"
                    name="projectId"
                    className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">— None (organization document) —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectNumber} – {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="erp-form-group">
                <Label htmlFor="category" className="erp-form-label">Category (optional)</Label>
                <Input
                  id="category"
                  name="category"
                  type="text"
                  className="mt-1 w-full"
                  placeholder="e.g. Contract, Drawings"
                />
              </div>

              <div className="erp-form-group">
                <Label htmlFor="description" className="erp-form-label">Description (optional)</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  className="mt-1 block w-full min-w-0 resize-y rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="Brief description of the document"
                />
              </div>

              <div className="erp-form-group">
                <FileUploader name="file" required />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? 'Uploading…' : 'Upload'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
