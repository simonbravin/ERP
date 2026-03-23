import { Card, CardContent } from '@/components/ui/card'

type StockSummaryProps = {
  totalItems: number
  totalLocations: number
  lowStockCount: number
  stockByLocation: { locationName: string; itemCount: number; totalQty: number }[]
}

export function StockSummary({
  totalItems,
  totalLocations,
  lowStockCount,
  stockByLocation: _stockByLocation,
}: StockSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">Total items</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-foreground">
            {totalItems}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">Locations</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-foreground">
            {totalLocations}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">Low stock alerts</p>
          <p
            className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
              lowStockCount > 0 ? 'text-status-warning' : 'text-foreground'
            }`}
          >
            {lowStockCount}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
