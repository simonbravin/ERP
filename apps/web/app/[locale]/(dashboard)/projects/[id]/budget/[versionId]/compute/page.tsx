import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProject } from '@/app/actions/projects'
import {
  getBudgetVersion,
  listBudgetLines,
} from '@/app/actions/budget'
import { getTranslations, getLocale } from 'next-intl/server'
import { PlanillaComputeView } from '@/components/budget/planilla-compute-view'
import { ExportPdfButton } from '@/components/print/export-pdf-button'

type PageProps = {
  params: Promise<{ id: string; versionId: string }>
}

/**
 * Planilla de cómputo - standalone compute sheet view for a budget version
 */
export default async function BudgetComputePage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, versionId } = await params
  const project = await getProject(projectId)
  if (!project) return notFound()

  const [version, lines] = await Promise.all([
    getBudgetVersion(versionId),
    listBudgetLines(versionId),
  ])

  if (!version || version.projectId !== projectId) return notFound()

  const [t, locale] = await Promise.all([getTranslations('budget'), getLocale()])

  const computeSheetLines = (lines ?? [])
    .map((line) => {
      const qty = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity)
      const total =
        line.salePriceTotal != null
          ? typeof line.salePriceTotal === 'number'
            ? line.salePriceTotal
            : Number(line.salePriceTotal)
          : typeof line.directCostTotal === 'number'
            ? line.directCostTotal
            : Number(line.directCostTotal)
      const unitPrice = qty > 0 ? total / qty : 0
      return {
        id: line.id,
        wbsCode: line.wbsNode.code,
        wbsName: line.wbsNode.name,
        unit: line.unit,
        quantity: qty,
        unitPrice,
        total,
        hasAPU: true,
      }
    })
    .sort((a, b) => a.wbsCode.localeCompare(b.wbsCode))

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href={`/projects/${projectId}/budget`}
          className="hover:text-slate-900"
        >
          {t('title')}
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${projectId}/budget/${versionId}`}
          className="hover:text-slate-900"
        >
          {version.versionCode}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">
          {t('computeSheet', { defaultValue: 'Planilla de cómputo' })}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('computeSheet', { defaultValue: 'Planilla de cómputo' })}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {version.versionCode} — {version.versionType} · {project.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportPdfButton
            versionId={versionId}
            locale={locale}
            label={t('exportPDF', { defaultValue: 'Exportar PDF' })}
          />
          <Link
            href={`/projects/${projectId}/budget/${versionId}`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← {t('version', { defaultValue: 'Volver a versión' })}
          </Link>
        </div>
      </div>

      {/* Compute sheet table */}
      <PlanillaComputeView computeSheetLines={computeSheetLines} />
    </div>
  )
}
