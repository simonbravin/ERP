'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { addRfiComment } from '@/app/actions/quality'

type RfiCommentFormProps = {
  rfiId: string
  projectId: string
}

export function RfiCommentForm({ rfiId, projectId: _projectId }: RfiCommentFormProps) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await addRfiComment(rfiId, comment.trim())
      setComment('')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full min-w-[280px] max-w-2xl space-y-2">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Add a comment..."
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
      <Button type="submit" disabled={submitting || !comment.trim()}>
        {submitting ? 'Adding…' : 'Add comment'}
      </Button>
    </form>
  )
}
