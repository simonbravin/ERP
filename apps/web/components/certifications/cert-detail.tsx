'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CertStatusBadge } from './cert-status-badge'
import { CertLineTable } from './cert-line-table'
import { formatPeriod, formatCurrency } from '@/lib/certification-utils'
import {
  issueCertification,
  approveCertification,
  rejectCertification,
  deleteCertification,
  deleteCertificationLine,
} from '@/app/actions/certifications'
import type { CertLineRow } from './cert-line-table'
import { Pencil, Trash2 } from 'lucide-react'

type CertDetailProps = {
  certId: string
  projectId: string
  number: number
  periodMonth: number
  periodYear: number
  status: string
  totalAmount: number
  integritySeal: string | null
  issuedDate: Date | null
  issuedBy: { user: { fullName: string } } | null
  approvedBy: { user: { fullName: string } } | null
  lines: CertLineRow[]
  canIssue: boolean
  canApprove: boolean
  canReject?: boolean
  canEdit: boolean
  canDelete?: boolean
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function CertDetail({
  certId,
  projectId,
  number: _number,
  periodMonth,
  periodYear,
  status,
  totalAmount,
  integritySeal,
  issuedDate,
  issuedBy,
  approvedBy,
  lines,
  canIssue,
  canApprove,
  canReject = false,
  canEdit,
  canDelete = false,
}: CertDetailProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const basePath = `/projects/${projectId}/finance/certifications`

  async function handleIssue() {
    setSubmitting(true)
    try {
      await issueCertification(certId)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to issue')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove() {
    setSubmitting(true)
    try {
      await approveCertification(certId)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject() {
    setSubmitting(true)
    try {
      await rejectCertification(certId)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteLine(lineId: string) {
    try {
      await deleteCertificationLine(lineId)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar partida')
    }
  }

  async function handleDeleteCert() {
    if (!confirm('¿Eliminar esta certificación? Esta acción no se puede deshacer.')) return
    setSubmitting(true)
    try {
      await deleteCertification(certId)
      router.push(basePath)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar certificación')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Período</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
              {formatPeriod(periodMonth, periodYear)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Estado</dt>
            <dd className="mt-0.5">
              <CertStatusBadge status={status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Monto total</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
              {formatCurrency(totalAmount)}
            </dd>
          </div>
          {issuedDate && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Fecha de emisión</dt>
              <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {formatDate(issuedDate)}
              </dd>
            </div>
          )}
          {issuedBy && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Emitida por</dt>
              <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {issuedBy.user.fullName}
              </dd>
            </div>
          )}
          {approvedBy && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Aprobada por</dt>
              <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {approvedBy.user.fullName}
              </dd>
            </div>
          )}
          {integritySeal && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Sello de integridad (SHA-256)</dt>
              <dd className="mt-0.5 break-all font-mono text-[10px] text-gray-500 dark:text-gray-500" title={integritySeal}>
                {integritySeal}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && status === 'DRAFT' && (
          <Link href={`${basePath}/${certId}/edit`}>
            <Button type="button" variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
        )}
        {canDelete && status !== 'APPROVED' && (
          <Button type="button" variant="outline" size="sm" onClick={handleDeleteCert} disabled={submitting} className="text-red-600 hover:text-red-700">
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        )}
        {canIssue && status === 'DRAFT' && (
          <Button onClick={handleIssue} disabled={submitting || lines.length === 0}>
            {submitting ? 'Emitiendo…' : 'Emitir certificación'}
          </Button>
        )}
        {status === 'ISSUED' && (
          <>
            {canReject && (
              <Button variant="outline" onClick={handleReject} disabled={submitting}>
                {submitting ? 'Rechazando…' : 'Rechazar'}
              </Button>
            )}
            {canApprove && (
              <Button onClick={handleApprove} disabled={submitting}>
                {submitting ? 'Aprobando…' : 'Aprobar'}
              </Button>
            )}
          </>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Partidas de la certificación</h2>
        <CertLineTable
          lines={lines}
          canDelete={canEdit && status === 'DRAFT'}
          onDelete={canEdit && status === 'DRAFT' ? handleDeleteLine : undefined}
        />
      </div>
    </div>
  )
}
