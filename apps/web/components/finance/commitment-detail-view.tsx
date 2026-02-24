'use client'

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
import { CommitmentDocumentsClient } from './commitment-documents-client'
import type { CommitmentDetailWithLines } from '@/app/actions/materials'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprobada',
}

interface Props {
  commitment: CommitmentDetailWithLines
}

export function CommitmentDetailView({ commitment }: Props) {
  const statusLabel = STATUS_LABELS[commitment.status] ?? commitment.status

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-mono">{commitment.commitmentNumber}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Fecha: {formatDateShort(commitment.issueDate)} · Proveedor: {commitment.partyName}
            </p>
          </div>
          <Badge variant={commitment.status === 'APPROVED' ? 'default' : 'secondary'}>
            {statusLabel}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {commitment.description && (
            <p className="text-sm text-muted-foreground">{commitment.description}</p>
          )}
          <p className="text-right text-lg font-semibold tabular-nums">
            Total: {formatCurrency(commitment.total, commitment.currency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">Descripción</TableHead>
                  <TableHead className="font-medium">WBS</TableHead>
                  <TableHead className="font-medium">Unidad</TableHead>
                  <TableHead className="text-right font-medium">Cantidad</TableHead>
                  <TableHead className="text-right font-medium">Precio unit.</TableHead>
                  <TableHead className="text-right font-medium">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commitment.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Sin líneas.
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
