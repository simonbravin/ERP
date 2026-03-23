'use client'

import { Link } from '@/i18n/navigation'
import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CommitmentDocumentsClient } from './commitment-documents-client'
import { approvePurchaseOrder } from '@/app/actions/materials'
import { createPurchaseFromCommitment } from '@/app/actions/finance-transactions'
import { exportPurchaseOrderToExcel } from '@/app/actions/export'
import type { CommitmentDetailWithLines } from '@/app/actions/materials'
import { toast } from 'sonner'
import { FileDown, FileSpreadsheet, Pencil, ShoppingCart } from 'lucide-react'
import { useTranslations } from 'next-intl'

const PO_EXPORT_COLUMNS = ['description', 'wbsCode', 'unit', 'quantity', 'unitPrice', 'totalCost']

const CAN_APPROVE_STATUSES = ['DRAFT', 'PENDING', 'SUBMITTED']
const CAN_EDIT_STATUSES = ['DRAFT']

const PO_COMMITMENT_STATUSES = ['DRAFT', 'PENDING', 'SUBMITTED', 'APPROVED'] as const
type PoCommitmentStatus = (typeof PO_COMMITMENT_STATUSES)[number]

interface Props {
  commitment: CommitmentDetailWithLines
}

export function CommitmentDetailView({ commitment }: Props) {
  const t = useTranslations('finance')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const statusLabel = PO_COMMITMENT_STATUSES.includes(commitment.status as PoCommitmentStatus)
    ? t(`purchaseOrderCommitmentStatus.${commitment.status as PoCommitmentStatus}`)
    : commitment.status
  const canApprove = CAN_APPROVE_STATUSES.includes(commitment.status)
  const canEdit = CAN_EDIT_STATUSES.includes(commitment.status)
  const isApproved = commitment.status === 'APPROVED'
  const hasLinkedTransaction = Boolean(commitment.linkedTransactionId)
  const [registeringPurchase, setRegisteringPurchase] = useState(false)

  function handleApprove() {
    startTransition(async () => {
      const result = await approvePurchaseOrder(commitment.id)
      if (result.success === true) {
        toast.success(t('toast.poApproved'))
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      const locale = typeof document !== 'undefined' ? document.documentElement.lang || 'es' : 'es'
      const params = new URLSearchParams({
        template: 'purchase-order',
        id: commitment.id,
        locale,
        showEmitidoPor: '1',
        showFullCompanyData: '1',
      })
      const res = await fetch(`/api/pdf?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.detail ?? data?.error ?? t('toast.commitmentPdfError'))
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `orden-compra-${commitment.commitmentNumber}.pdf`
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function handleRegistrarComoCompra() {
    setRegisteringPurchase(true)
    try {
      const result = await createPurchaseFromCommitment(commitment.id)
      if (result.success === true) {
        toast.success(
          result.alreadyExists
            ? t('toast.purchaseFromCommitmentAlreadyRegistered')
            : t('toast.purchaseFromCommitmentRegistered')
        )
        router.push(`/finance/transactions/${result.transactionId}`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setRegisteringPurchase(false)
    }
  }

  async function handleDownloadExcel() {
    setDownloadingExcel(true)
    try {
      const result = await exportPurchaseOrderToExcel(commitment.id, PO_EXPORT_COLUMNS)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (result.data && result.filename) {
        const bin = atob(result.data)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        const blob = new Blob([arr], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = result.filename
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } finally {
      setDownloadingExcel(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-mono">{commitment.commitmentNumber}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('purchaseOrderDetail.meta', {
                date: formatDateShort(commitment.issueDate),
                supplier: commitment.partyName,
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {downloadingPdf ? '…' : t('purchaseOrderDetail.downloadPdf')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {downloadingExcel ? '…' : t('purchaseOrderDetail.downloadExcel')}
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${commitment.projectId}/finance/purchase-orders/${commitment.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('purchaseOrderDetail.edit')}
                </Link>
              </Button>
            )}
            {isApproved && (
              hasLinkedTransaction ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/finance/transactions/${commitment.linkedTransactionId}`}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {t('purchaseOrderDetail.viewPurchase')}
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegistrarComoCompra}
                  disabled={registeringPurchase}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {registeringPurchase ? '…' : t('purchaseOrderDetail.registerAsPurchase')}
                </Button>
              )
            )}
            {canApprove && (
              <Button onClick={handleApprove} disabled={isPending}>
                {isPending ? '…' : 'Aprobar'}
              </Button>
            )}
            <Badge variant={commitment.status === 'APPROVED' ? 'default' : 'secondary'}>
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {commitment.description && (
            <p className="text-sm text-muted-foreground">{commitment.description}</p>
          )}
          <p className="text-right text-lg font-semibold tabular-nums">
            {t('purchaseOrderDetail.totalLabel')}{' '}
            {formatCurrency(commitment.total, commitment.currency)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">{t('purchaseOrderDetail.linesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">{t('purchaseOrderDetail.colDescription')}</TableHead>
                  <TableHead className="font-medium">{t('purchaseOrderDetail.colWbs')}</TableHead>
                  <TableHead className="font-medium">{t('purchaseOrderDetail.colUnit')}</TableHead>
                  <TableHead className="text-right font-medium">{t('purchaseOrderDetail.colQuantity')}</TableHead>
                  <TableHead className="text-right font-medium">{t('purchaseOrderDetail.colUnitPrice')}</TableHead>
                  <TableHead className="text-right font-medium">{t('purchaseOrderDetail.colTotal')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commitment.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {t('purchaseOrderDetail.linesEmpty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  commitment.lines.map((line) => (
                    <TableRow key={line.id} className="border-b border-border/50">
                      <TableCell className="max-w-[240px]">{line.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {line.wbsCode && line.wbsName
                          ? `${line.wbsCode} – ${line.wbsName}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{line.unit ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(line.unitPrice, commitment.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(line.lineTotal, commitment.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CommitmentDocumentsClient commitmentId={commitment.id} projectId={commitment.projectId} />
    </div>
  )
}
