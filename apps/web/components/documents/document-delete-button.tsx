'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type DocumentDeleteButtonProps = {
  docId: string
  redirectTo: string
  deleteDocument: (docId: string) => Promise<unknown>
}

export function DocumentDeleteButton({
  docId,
  redirectTo,
  deleteDocument,
}: DocumentDeleteButtonProps) {
  const router = useRouter()
  const t = useTranslations('documents')
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(t('deleteConfirm'))) {
      return
    }
    setDeleting(true)
    try {
      await deleteDocument(docId)
      router.push(redirectTo)
      router.refresh()
      toast.success(t('delete'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? t('deleting') : t('delete')}
    </Button>
  )
}
