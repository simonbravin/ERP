'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createDocumentFolder } from '@/app/actions/documents'
import { toast } from 'sonner'
import { FolderPlus } from 'lucide-react'

type CreateFolderButtonProps = {
  parentId?: string
  projectId?: string
}

export function CreateFolderButton({ parentId, projectId }: CreateFolderButtonProps) {
  const router = useRouter()
  const t = useTranslations('documents')
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await createDocumentFolder({
        parentId: parentId ?? null,
        projectId: projectId ?? null,
        name: name.trim(),
      })
      setName('')
      setIsOpen(false)
      router.refresh()
      toast.success(t('newFolder'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)} className="gap-2">
        <FolderPlus className="h-4 w-4" />
        {t('newFolder')}
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="erp-form-modal w-full min-w-[320px] max-w-md rounded-lg border border-border bg-card p-6 shadow-xl sm:p-8">
            <h2 className="mb-6 text-xl font-semibold text-foreground sm:mb-8">
              {t('newFolder')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="erp-form-group">
                <Label htmlFor="folder-name" className="erp-form-label">
                  {t('titleLabel')}
                </Label>
                <Input
                  id="folder-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('folderTitlePlaceholder')}
                  className="erp-form-input mt-1 w-full min-w-0"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsOpen(false); setName('') }}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={submitting || !name.trim()}>
                  {submitting ? t('uploading') : t('newFolder')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
