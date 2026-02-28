'use client'

import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { createRfi } from '@/app/actions/quality'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const createRfiSchema = z.object({
  subject: z.string().min(1).max(255),
  question: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  wbsNodeId: z.string().uuid().optional().nullable(),
  assignedToOrgMemberId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
})
type CreateRfiInput = z.infer<typeof createRfiSchema>

type WbsNode = { id: string; code: string; name: string }
type OrgMember = { id: string; user: { fullName: string } }

type RfiFormProps = {
  projectId: string
  wbsNodes: WbsNode[]
  orgMembers: OrgMember[]
}

const inputClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const textareaClassName =
  'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

export function RfiForm({ projectId, wbsNodes, orgMembers }: RfiFormProps) {
  const t = useTranslations('quality')
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateRfiInput>({
    resolver: zodResolver(createRfiSchema),
    defaultValues: { priority: 'MEDIUM' },
  })

  const priority = watch('priority')
  const wbsNodeId = watch('wbsNodeId')
  const assignedToOrgMemberId = watch('assignedToOrgMemberId')

  async function onSubmit(data: CreateRfiInput) {
    try {
      const result = await createRfi(projectId, {
        ...data,
        wbsNodeId: data.wbsNodeId || null,
        assignedToOrgMemberId: data.assignedToOrgMemberId || null,
        dueDate: data.dueDate || null,
      })
      if ('rfiId' in result) {
        router.push(`/projects/${projectId}/quality/rfis/${result.rfiId}`)
        router.refresh()
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : t('createRfi'),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-1">
        <div className="space-y-2">
          <Label htmlFor="subject">{t('subject')}</Label>
          <Input
            id="subject"
            {...register('subject')}
            placeholder={t('subjectPlaceholder')}
            className={cn(inputClassName, 'h-10')}
          />
          {errors.subject && (
            <p className="text-sm text-destructive">{errors.subject.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="question">{t('question')}</Label>
          <textarea
            id="question"
            {...register('question')}
            rows={4}
            className={textareaClassName}
          />
          {errors.question && (
            <p className="text-sm text-destructive">{errors.question.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('priorityLabel')}</Label>
            <Select
              value={priority}
              onValueChange={(v) => setValue('priority', v as CreateRfiInput['priority'])}
            >
              <SelectTrigger className={inputClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">{t('priority.LOW')}</SelectItem>
                <SelectItem value="MEDIUM">{t('priority.MEDIUM')}</SelectItem>
                <SelectItem value="HIGH">{t('priority.HIGH')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">{t('dueDate')}</Label>
            <Input
              id="dueDate"
              type="date"
              {...register('dueDate')}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('wbsLocation')}</Label>
          <Select
            value={wbsNodeId ?? '_none'}
            onValueChange={(v) => setValue('wbsNodeId', v === '_none' ? null : v)}
          >
            <SelectTrigger className={inputClassName}>
              <SelectValue placeholder={t('selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t('selectOption')}</SelectItem>
              {wbsNodes.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.code} — {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('assignTo')}</Label>
          <Select
            value={assignedToOrgMemberId ?? '_none'}
            onValueChange={(v) =>
              setValue('assignedToOrgMemberId', v === '_none' ? null : v)
            }
          >
            <SelectTrigger className={inputClassName}>
              <SelectValue placeholder={t('unassigned')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t('unassigned')}</SelectItem>
              {orgMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.user.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '…' : t('createRfi')}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/projects/${projectId}/quality/rfis`}>{t('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
