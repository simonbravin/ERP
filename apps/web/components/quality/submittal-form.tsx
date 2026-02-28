'use client'

import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { createSubmittal } from '@/app/actions/quality'
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

const SUBMITTAL_TYPES = [
  'MATERIAL',
  'PRODUCT',
  'SHOP_DRAWING',
  'SAMPLES',
  'CUT_SHEETS',
  'OTHER',
] as const

const createSubmittalSchema = z.object({
  submittalType: z.string().min(1),
  specSection: z.string().max(50).optional().nullable(),
  wbsNodeId: z.string().uuid().optional().nullable(),
  submittedByPartyId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date(),
})
type CreateSubmittalInput = z.infer<typeof createSubmittalSchema>

type WbsNode = { id: string; code: string; name: string }
type Party = { id: string; name: string }

type SubmittalFormProps = {
  projectId: string
  wbsNodes: WbsNode[]
  parties: Party[]
}

const inputClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

export function SubmittalForm({
  projectId,
  wbsNodes,
  parties,
}: SubmittalFormProps) {
  const t = useTranslations('quality')
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubmittalInput>({
    resolver: zodResolver(createSubmittalSchema),
    defaultValues: { submittalType: 'MATERIAL' },
  })

  const submittalType = watch('submittalType')
  const wbsNodeId = watch('wbsNodeId')
  const submittedByPartyId = watch('submittedByPartyId')

  async function onSubmit(data: CreateSubmittalInput) {
    try {
      const result = await createSubmittal(projectId, {
        ...data,
        wbsNodeId: data.wbsNodeId || null,
        submittedByPartyId: data.submittedByPartyId || null,
        specSection: data.specSection || null,
      })
      if ('submittalId' in result) {
        router.push(
          `/projects/${projectId}/quality/submittals/${result.submittalId}`
        )
        router.refresh()
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : t('createSubmittal'),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-1">
        <div className="space-y-2">
          <Label>{t('type')}</Label>
          <Select
            value={submittalType}
            onValueChange={(v) => setValue('submittalType', v)}
          >
            <SelectTrigger className={inputClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBMITTAL_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`submittalType.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="specSection">{t('specSection')}</Label>
          <Input
            id="specSection"
            {...register('specSection')}
            placeholder={t('specSectionPlaceholder')}
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">{t('dueDate')}</Label>
          <Input
            id="dueDate"
            type="date"
            {...register('dueDate')}
            className={inputClassName}
            required
          />
          {errors.dueDate && (
            <p className="text-sm text-destructive">{errors.dueDate.message}</p>
          )}
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
          <Label>{t('submittedByParty')}</Label>
          <Select
            value={submittedByPartyId ?? '_none'}
            onValueChange={(v) =>
              setValue('submittedByPartyId', v === '_none' ? null : v)
            }
          >
            <SelectTrigger className={inputClassName}>
              <SelectValue placeholder={t('selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t('selectOption')}</SelectItem>
              {parties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
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
          {isSubmitting ? '…' : t('createSubmittal')}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/projects/${projectId}/quality/submittals`}>
            {t('cancel')}
          </Link>
        </Button>
      </div>
    </form>
  )
}
