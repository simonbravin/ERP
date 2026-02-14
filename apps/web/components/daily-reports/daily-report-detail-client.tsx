'use client'

import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { useTransition, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { uploadDailyReportFiles } from '@/app/actions/daily-reports'

type Report = Awaited<ReturnType<typeof import('@/app/actions/daily-reports').getDailyReport>>

type DailyReportDetailClientProps = {
  projectId: string
  report: NonNullable<Report>
  canEditReport: boolean
  canSubmitReport: boolean
  canApproveReport: boolean
  canPublishReport: boolean
  isAuthor: boolean
  onApprove: (id: string) => Promise<unknown>
  onReject: (id: string, reason: string) => Promise<unknown>
  onPublish: (id: string) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function StatusBadge({ statusKey, label }: { statusKey: string; label: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    SUBMITTED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    APPROVED: 'badge-success',
    PUBLISHED: 'bg-violet-100/80 text-violet-700 dark:bg-violet-900/25 dark:text-violet-400',
  }
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-xs font-medium',
        styles[statusKey] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      )}
    >
      {label || statusKey}
    </span>
  )
}

export function DailyReportDetailClient({
  projectId,
  report,
  canEditReport,
  canSubmitReport,
  canApproveReport,
  canPublishReport,
  onApprove,
  onReject,
  onPublish,
  onDelete,
}: DailyReportDetailClientProps) {
  const t = useTranslations('dailyReports')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const statusLabels: Record<string, string> = {
    DRAFT: t('statusDraft'),
    SUBMITTED: t('statusSubmitted'),
    APPROVED: t('statusApproved'),
    PUBLISHED: t('statusPublished'),
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        const { submitDailyReport } = await import('@/app/actions/daily-reports')
        await submitDailyReport(report.id)
        toast.success('Reporte enviado.')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al enviar.')
      }
    })
  }

  function handleApprove() {
    startTransition(async () => {
      try {
        await onApprove(report.id)
        toast.success('Reporte aprobado.')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al aprobar.')
      }
    })
  }

  function handleReject() {
    if (!rejectReason.trim()) {
      toast.error(t('rejectReason'))
      return
    }
    startTransition(async () => {
      try {
        await onReject(report.id, rejectReason.trim())
        toast.success('Reporte rechazado.')
        setShowReject(false)
        setRejectReason('')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al rechazar.')
      }
    })
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        await onPublish(report.id)
        toast.success(t('published'))
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al publicar.')
      }
    })
  }

  function handleDelete() {
    if (!confirm(t('confirmDelete'))) return
    startTransition(async () => {
      try {
        await onDelete(report.id)
        toast.success('Reporte eliminado.')
        router.push(`/projects/${projectId}/daily-reports`)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al eliminar.')
      }
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    if (report.photos.length + files.length > 10) {
      toast.error('Máximo 10 archivos por reporte.')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) formData.append('files', files[i])
      await uploadDailyReportFiles(report.id, projectId, formData)
      toast.success('Archivos subidos.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatDate(report.reportDate)} — {report.summary.slice(0, 50)}
            {report.summary.length > 50 ? '...' : ''}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('author')}: {report.createdBy.user.fullName}
            {' · '}
            <StatusBadge statusKey={report.status} label={statusLabels[report.status] ?? report.status} />
            {(report.status === 'APPROVED' || report.status === 'PUBLISHED') && report.approvedBy?.user?.fullName && (
              <> · {t('approvedByColumn')}: {report.approvedBy.user.fullName}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canEditReport && (
            <Link href={`/projects/${projectId}/daily-reports/${report.id}/edit`}>
              <Button type="button" variant="outline" size="sm">
                {t('editReport')}
              </Button>
            </Link>
          )}
          {canSubmitReport && (
            <Button type="button" size="sm" onClick={handleSubmit} disabled={isPending}>
              {t('submit')}
            </Button>
          )}
          {canApproveReport && (
            <>
              <Button type="button" size="sm" onClick={handleApprove} disabled={isPending}>
                {t('approve')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowReject(!showReject)}
              >
                {t('reject')}
              </Button>
            </>
          )}
          {canPublishReport && (
            <Button type="button" size="sm" onClick={handlePublish} disabled={isPending}>
              {t('publish')}
            </Button>
          )}
          {canEditReport && (
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
              {t('deleteReport')}
            </Button>
          )}
        </div>
      </div>

      {showReject && canApproveReport && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('rejectReason')}
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
              {t('reject')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowReject(false)}>
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('summary')}</h2>
        <p className="mt-2 text-gray-700 dark:text-gray-300">{report.summary}</p>
        {report.workAccomplished && (
          <>
            <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">{t('workAccomplished')}</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {report.workAccomplished}
            </p>
          </>
        )}
        {(((report as { wbsNodes?: unknown[] }).wbsNodes?.length ?? 0) > 0 || report.wbsNode) && (
          <>
            <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">WBS — partidas trabajadas</h2>
            <ul className="mt-2 list-disc pl-6 text-sm text-gray-700 dark:text-gray-300">
              {(report as { wbsNodes?: { wbsNode: { code: string; name: string } }[] }).wbsNodes?.map((n) => (
                <li key={n.wbsNode.code}>
                  <span className="font-mono text-gray-600 dark:text-gray-400">{n.wbsNode.code}</span>
                  {' — '}
                  {n.wbsNode.name}
                </li>
              )) ??
                (report.wbsNode ? (
                  <li>
                    <span className="font-mono text-gray-600 dark:text-gray-400">{report.wbsNode.code}</span>
                    {' — '}
                    {report.wbsNode.name}
                  </li>
                ) : null)}
            </ul>
          </>
        )}
        {report.labor.length > 0 && (
          <>
            <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">{t('labor')}</h2>
            <table className="mt-2 w-full max-w-md text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  <th className="py-2">{t('speciality')}</th>
                  <th className="py-2">{t('quantity')}</th>
                  <th className="py-2">{t('hours')}</th>
                </tr>
              </thead>
              <tbody>
                {report.labor.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2">{row.trade}</td>
                    <td className="py-2">{row.workerCount}</td>
                    <td className="py-2">{Number(row.hoursWorked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {report.weather && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t('weather')}: {report.weather}
          </p>
        )}
        {report.observations && (
          <>
            <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">{t('observations')}</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {report.observations}
            </p>
          </>
        )}
        {report.photos.length > 0 && (
          <>
            <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">{t('photosAndDocs')}</h2>
            <ul className="mt-2 list-disc pl-6 text-sm text-gray-600 dark:text-gray-400">
              {report.photos.map((p) => (
                <li key={p.id}>
                  {p.document.title}
                  {p.caption && ` — ${p.caption}`}
                </li>
              ))}
            </ul>
          </>
        )}
        {canEditReport && report.photos.length < 10 && (
          <div className="mt-6 rounded border border-dashed border-gray-300 p-4 dark:border-gray-600">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {report.photos.length > 0 ? 'Agregar más fotos/documentos' : t('photosAndDocs')}
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('dropzoneHint')}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 dark:file:bg-gray-800 dark:file:text-gray-300"
            />
            {uploading && <p className="mt-2 text-sm text-gray-500">{tCommon('loading')}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
