'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'

interface Payment {
  id: string
  description: string
  dueDate: Date | null
  amount: number
  supplier: string
  project: string
}

interface UpcomingPaymentsCompanyProps {
  payments: Payment[]
}

export function UpcomingPaymentsCompany({ payments }: UpcomingPaymentsCompanyProps) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Próximos vencimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hay pagos por vencer en los próximos 30 días
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos vencimientos (30 días)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead className="text-right">Monto ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.dueDate ? formatDateShort(p.dueDate) : '—'}</TableCell>
                <TableCell className="max-w-[200px] truncate">{p.description}</TableCell>
                <TableCell>{p.supplier}</TableCell>
                <TableCell>{p.project}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(p.amount, 'ARS')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
