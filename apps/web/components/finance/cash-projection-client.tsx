'use client'

import { useState, useTransition } from 'react'
import { formatCurrency } from '@/lib/format-utils'
import { getCompanyCashProjection, getProjectCashProjection } from '@/app/actions/finance'
import type { CashProjectionResult } from '@/app/actions/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  initialProjection: CashProjectionResult | null
  projectId?: string | null
  title?: string
}

export function CashProjectionClient({
  initialProjection,
  projectId = null,
  title = 'Proyección de caja',
}: Props) {
  const [projection, setProjection] = useState<CashProjectionResult | null>(initialProjection)
  const [isPending, startTransition] = useTransition()
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10))

  function loadProjection() {
    const date = new Date(asOfDate)
    startTransition(async () => {
      const result = projectId
        ? await getProjectCashProjection(projectId, date)
        : await getCompanyCashProjection(date)
      setProjection(result)
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <label className="text-sm font-medium text-foreground">Fecha a proyectar:</label>
        <Input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="max-w-[180px]"
        />
        <Button type="button" onClick={loadProjection} disabled={isPending}>
          {isPending ? 'Calculando...' : 'Calcular proyección'}
        </Button>
      </div>

      {projection && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cobros recibidos hasta la fecha</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(projection.paidIncomeToDate)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pagos realizados hasta la fecha</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(projection.paidExpenseToDate)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cuentas por cobrar (vencimiento ≤ fecha)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(projection.receivablesDueByDate)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cuentas por pagar (vencimiento ≤ fecha)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(projection.payablesDueByDate)}
              </p>
            </CardContent>
          </Card>
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Capital proyectado a {projection.asOfDate}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${projection.projectedBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(projection.projectedBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cobros recibidos − Pagos realizados + Cuentas por cobrar − Cuentas por pagar
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!projection && !isPending && (
        <p className="text-sm text-muted-foreground">Elija una fecha y pulse &quot;Calcular proyección&quot;.</p>
      )}
    </div>
  )
}
