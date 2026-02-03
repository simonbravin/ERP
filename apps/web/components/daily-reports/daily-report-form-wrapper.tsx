'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { DailyReportForm } from './daily-report-form'
import { createDailyReport, submitDailyReport } from '@/app/actions/daily-reports'
import type { CreateDailyReportInput, UpdateDailyReportInput, LaborEntryInput } from '@repo/validators'

type WbsOption = { id: string; code: string; name: string }

type DailyReportFormWrapperProps = {
  mode: 'create' | 'edit'
  projectId: string
  reportId?: string
  defaultValues?: Partial<UpdateDailyReportInput> & { laborEntries?: LaborEntryInput[] }
  wbsOptions?: WbsOption[]
  onCancelHref: string
}

export function DailyReportFormWrapper({
  mode,
  projectId,
  reportId,
  defaultValues,
  wbsOptions = [],
  onCancelHref,
}: DailyReportFormWrapperProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleCreate(data: CreateDailyReportInput, action: 'draft' | 'submit') {
    setIsPending(true)
    try {
      const report = await createDailyReport(projectId, data)
      const reportId = report && typeof report === 'object' && 'id' in report ? String((report as { id: string }).id) : null
      if (action === 'submit' && reportId) {
        await submitDailyReport(reportId)
        toast.success('Reporte creado y enviado.')
      } else if (action === 'submit' && !reportId) {
        toast.error('No se pudo enviar el reporte. Guardado como borrador.')
      } else {
        toast.success('Borrador guardado.')
      }
      router.push(`/projects/${projectId}/daily-reports`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar.')
      throw e
    } finally {
      setIsPending(false)
    }
  }

  async function handleEdit(data: UpdateDailyReportInput, action: 'draft' | 'submit') {
    if (!reportId) throw new Error('reportId requerido')
    setIsPending(true)
    try {
      const { updateDailyReport, submitDailyReport } = await import('@/app/actions/daily-reports')
      await updateDailyReport(reportId, data)
      if (action === 'submit') {
        await submitDailyReport(reportId)
        toast.success('Reporte actualizado y enviado.')
      } else {
        toast.success('Borrador actualizado.')
      }
      router.push(`/projects/${projectId}/daily-reports/${reportId}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar.')
      throw e
    } finally {
      setIsPending(false)
    }
  }

  return (
    <DailyReportForm
      mode={mode}
      projectId={projectId}
      defaultValues={defaultValues}
      wbsOptions={wbsOptions}
      onSubmitCreate={handleCreate}
      onSubmitEdit={handleEdit}
      onCancelHref={onCancelHref}
      isSubmitting={isPending}
    />
  )
}
