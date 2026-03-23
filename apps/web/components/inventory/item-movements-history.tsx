'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/lib/format-utils'
import { ArrowRight, Minus, ArrowRightLeft, ShoppingCart } from 'lucide-react'
import type { InventoryMovementClientRow } from '@/lib/types/inventory-dto'

interface ItemMovementsHistoryProps {
  movements: InventoryMovementClientRow[]
  unit: string
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return (v as { toNumber?: () => number })?.toNumber?.() ?? 0
}

const movementTypes: Record<
  string,
  { label: string; icon: typeof ShoppingCart; variant: 'success' | 'info' | 'warning' | 'neutral' }
> = {
  PURCHASE: { label: 'Compra', icon: ShoppingCart, variant: 'success' },
  TRANSFER: { label: 'Transferencia', icon: ArrowRightLeft, variant: 'info' },
  ISSUE: { label: 'Consumo', icon: Minus, variant: 'warning' },
  ADJUSTMENT: { label: 'Ajuste', icon: Minus, variant: 'neutral' },
}

export function ItemMovementsHistory({ movements, unit }: ItemMovementsHistoryProps) {
  return (
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold">Historial de Movimientos</h3>

      {movements.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay movimientos registrados
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border text-left text-sm text-muted-foreground">
              <tr>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Desde</th>
                <th className="pb-3 font-medium"></th>
                <th className="pb-3 font-medium">Hacia</th>
                <th className="pb-3 text-right font-medium">Cantidad</th>
                <th className="pb-3 text-right font-medium">Costo Unit.</th>
                <th className="pb-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.map((movement) => {
                const typeInfo = movementTypes[movement.movementType] ?? {
                  label: movement.movementType,
                  icon: Minus,
                  variant: 'neutral' as const,
                }
                const Icon = typeInfo.icon

                return (
                  <tr key={movement.id} className="text-sm">
                    <td className="py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(movement.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </td>
                    <td className="py-3">
                      <Badge variant={typeInfo.variant} className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {typeInfo.label}
                      </Badge>
                    </td>
                    <td className="py-3">{movement.fromLocation?.name ?? '-'}</td>
                    <td className="py-3 text-center">
                      <ArrowRight className="inline h-4 w-4 text-muted-foreground" />
                    </td>
                    <td className="py-3">
                      {movement.toLocation?.name ?? '-'}
                      {movement.project && (
                        <div className="text-xs text-muted-foreground">
                          {movement.project.projectNumber}
                        </div>
                      )}
                      {movement.wbsNode && (
                        <div className="text-xs text-muted-foreground">
                          {movement.wbsNode.code} - {movement.wbsNode.name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {toNum(movement.quantity).toFixed(2)} {unit}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {movement.unitCost != null && toNum(movement.unitCost) > 0
                        ? formatCurrency(toNum(movement.unitCost))
                        : '-'}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {movement.createdBy?.user?.fullName ?? 'Sistema'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
