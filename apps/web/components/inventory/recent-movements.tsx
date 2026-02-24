'use client'

import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'
import { formatCurrency, formatDateShort } from '@/lib/format-utils'

type MovementRow = {
  id: string
  movementType: string
  quantity: unknown
  totalCost: unknown
  createdAt: Date
  item: { id: string; sku: string; name: string; unit: string }
  fromLocation: { name: string } | null
  toLocation: { name: string } | null
  createdBy?: {
    user: { fullName: string } | null
  } | null
}

interface RecentMovementsProps {
  movements: MovementRow[]
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  return (v as { toNumber?: () => number })?.toNumber?.() ?? 0
}

const CARD_CLASS = 'rounded-xl border border-border/60 bg-card shadow-sm min-w-0'

export function RecentMovements({ movements }: RecentMovementsProps) {
  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-medium">Movimientos recientes</h3>
        <Link
          href="/inventory/movements"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver historial
        </Link>
      </div>
      <div className="px-5 py-4">
        {movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay movimientos recientes</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto overflow-x-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Origen / Destino</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cant.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Costo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Usuario</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link href={`/inventory/items/${m.item.id}`} className="font-medium hover:underline">
                        {m.item.sku} – {m.item.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="neutral">{m.movementType}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.fromLocation?.name ?? '—'} → {m.toLocation?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{toNum(m.quantity).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(toNum(m.totalCost))}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.createdBy?.user?.fullName ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{formatDateShort(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
