'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/lib/format-utils'
import {
  ShoppingCart,
  ArrowRightLeft,
  Minus,
  Plus,
  ArrowRight,
  Search,
  X,
  ChevronDown,
} from 'lucide-react'

interface MovementsListClientProps {
  movements: Array<{
    id: string
    movementType: string
    quantity: unknown
    unitCost: unknown
    createdAt: Date
    item: { sku: string; name: string; unit: string }
    fromLocation?: { name: string; type: string } | null
    toLocation?: { name: string; type: string } | null
    project?: { projectNumber: string; name: string } | null
    wbsNode?: { code: string; name: string } | null
    createdBy?: { user?: { fullName: string } } | null
  }>
  items: Array<{ id: string; sku: string; name: string }>
  locations: Array<{ id: string; name: string }>
}

const movementTypes: Record<
  string,
  { label: string; icon: typeof ShoppingCart; variant: 'success' | 'info' | 'warning' | 'neutral' }
> = {
  PURCHASE: { label: 'Compra', icon: ShoppingCart, variant: 'success' },
  TRANSFER: { label: 'Transferencia', icon: ArrowRightLeft, variant: 'info' },
  ISSUE: { label: 'Consumo', icon: Minus, variant: 'warning' },
  ADJUSTMENT: { label: 'Ajuste', icon: Plus, variant: 'neutral' },
}

const MOVEMENT_TYPE_OPTIONS = [
  { id: 'PURCHASE', label: 'Compra' },
  { id: 'TRANSFER', label: 'Transferencia' },
  { id: 'ISSUE', label: 'Consumo' },
  { id: 'ADJUSTMENT', label: 'Ajuste' },
]

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return (v as { toNumber?: () => number })?.toNumber?.() ?? 0
}

function parseMultiParam(value: string | null): string[] {
  if (!value || typeof value !== 'string') return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function FilterMultiSelect({
  label,
  options,
  selectedIds,
  onSelectionChange,
  searchPlaceholder = 'Buscar...',
  allLabel = 'Todos',
}: {
  label: string
  options: { id: string; label: string }[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  searchPlaceholder?: string
  allLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const q = search.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  const handleToggle = (id: string, checked: boolean) => {
    const next = checked
      ? [...selectedIds, id]
      : selectedIds.filter((x) => x !== id)
    onSelectionChange(next)
  }

  const buttonLabel =
    selectedIds.length === 0
      ? allLabel
      : selectedIds.length === options.length
        ? allLabel
        : `${selectedIds.length} seleccionado(s)`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{buttonLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 p-0">
          <div className="border-b p-2">
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={selectedIds.includes(opt.id)}
                  onCheckedChange={(checked) =>
                    handleToggle(opt.id, checked === true)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
                <span>{opt.label}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function MovementsListClient({
  movements,
  items,
  locations,
}: MovementsListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const typeParam = searchParams.get('type') ?? ''
  const itemIdParam = searchParams.get('itemId') ?? ''
  const locationIdParam = searchParams.get('locationId') ?? ''
  const fromParam = searchParams.get('from') ?? ''
  const toParam = searchParams.get('to') ?? ''

  const typeIds = useMemo(() => parseMultiParam(typeParam), [typeParam])
  const itemIds = useMemo(() => parseMultiParam(itemIdParam), [itemIdParam])
  const locationIds = useMemo(() => parseMultiParam(locationIdParam), [locationIdParam])

  const [searchQuery, setSearchQuery] = useState('')

  const updateUrl = useCallback(
    (updates: {
      type?: string[]
      itemId?: string[]
      locationId?: string[]
      from?: string
      to?: string
    }) => {
      const params = new URLSearchParams()
      const type = updates.type !== undefined ? updates.type : typeIds
      const itemId = updates.itemId !== undefined ? updates.itemId : itemIds
      const locationId =
        updates.locationId !== undefined ? updates.locationId : locationIds
      const from = updates.from !== undefined ? updates.from : fromParam
      const to = updates.to !== undefined ? updates.to : toParam
      if (type.length) params.set('type', type.join(','))
      if (itemId.length) params.set('itemId', itemId.join(','))
      if (locationId.length) params.set('locationId', locationId.join(','))
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      router.push(`/inventory/movements?${params.toString()}`)
    },
    [router, typeIds, itemIds, locationIds, fromParam, toParam]
  )

  const handleClearFilters = () => {
    setSearchQuery('')
    router.push('/inventory/movements')
  }

  const hasActiveFilters =
    typeIds.length > 0 ||
    itemIds.length > 0 ||
    locationIds.length > 0 ||
    fromParam !== '' ||
    toParam !== ''

  const itemOptions = useMemo(
    () => items.map((i) => ({ id: i.id, label: `${i.sku} - ${i.name}` })),
    [items]
  )
  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: l.id, label: l.name })),
    [locations]
  )

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return movements
    const q = searchQuery.trim().toLowerCase()
    return movements.filter((m) => {
      const itemMatch =
        m.item.name.toLowerCase().includes(q) ||
        m.item.sku.toLowerCase().includes(q)
      const fromMatch = m.fromLocation?.name?.toLowerCase().includes(q)
      const toMatch = m.toLocation?.name?.toLowerCase().includes(q)
      const typeLabel =
        movementTypes[m.movementType]?.label?.toLowerCase().includes(q)
      return itemMatch || fromMatch || toMatch || typeLabel
    })
  }, [movements, searchQuery])

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por item, SKU, ubicación o tipo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtros siempre visibles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <FilterMultiSelect
          label="Tipo de movimiento"
          options={MOVEMENT_TYPE_OPTIONS}
          selectedIds={typeIds}
          onSelectionChange={(ids) => updateUrl({ type: ids })}
          searchPlaceholder="Buscar tipo..."
          allLabel="Todos"
        />
        <FilterMultiSelect
          label="Item"
          options={itemOptions}
          selectedIds={itemIds}
          onSelectionChange={(ids) => updateUrl({ itemId: ids })}
          searchPlaceholder="Buscar item..."
          allLabel="Todos"
        />
        <FilterMultiSelect
          label="Ubicación"
          options={locationOptions}
          selectedIds={locationIds}
          onSelectionChange={(ids) => updateUrl({ locationId: ids })}
          searchPlaceholder="Buscar ubicación..."
          allLabel="Todas"
        />
        <div>
          <label className="mb-2 block text-sm font-medium">Desde</label>
          <Input
            type="date"
            value={fromParam}
            onChange={(e) => updateUrl({ from: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Hasta</label>
          <Input
            type="date"
            value={toParam}
            onChange={(e) => updateUrl({ to: e.target.value })}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr className="text-left text-sm">
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Item</th>
                <th className="p-4 font-medium">Desde</th>
                <th className="p-4 font-medium"></th>
                <th className="p-4 font-medium">Hacia</th>
                <th className="p-4 text-right font-medium">Cantidad</th>
                <th className="p-4 text-right font-medium">Costo Unit.</th>
                <th className="p-4 text-right font-medium">Total</th>
                <th className="p-4 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBySearch.map((movement) => {
                const typeInfo =
                  movementTypes[movement.movementType] ??
                  movementTypes.ADJUSTMENT
                const Icon = typeInfo.icon
                const qty = toNum(movement.quantity)
                const unitCost = toNum(movement.unitCost)
                const totalCost = qty * unitCost

                return (
                  <tr
                    key={movement.id}
                    className="text-sm hover:bg-muted/30"
                  >
                    <td className="p-4 text-muted-foreground">
                      {formatDistanceToNow(new Date(movement.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={typeInfo.variant}
                        className="inline-flex items-center gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {typeInfo.label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div>
                        <span className="font-medium">{movement.item.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {movement.item.sku}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      {movement.fromLocation?.name ?? '-'}
                    </td>
                    <td className="p-4">
                      <ArrowRight className="inline h-4 w-4 text-muted-foreground" />
                    </td>
                    <td className="p-4">
                      {movement.toLocation?.name ?? '-'}
                      {movement.project && (
                        <p className="text-xs text-muted-foreground">
                          {movement.project.projectNumber}
                        </p>
                      )}
                      {movement.wbsNode && (
                        <p className="text-xs text-muted-foreground">
                          {movement.wbsNode.code} - {movement.wbsNode.name}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono tabular-nums">
                      {qty.toFixed(2)} {movement.item.unit}
                    </td>
                    <td className="p-4 text-right font-mono tabular-nums">
                      {unitCost > 0 ? formatCurrency(unitCost) : '-'}
                    </td>
                    <td className="p-4 text-right font-mono tabular-nums font-medium">
                      {unitCost > 0 ? formatCurrency(totalCost) : '-'}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {movement.createdBy?.user?.fullName ?? 'Sistema'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredBySearch.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              {movements.length === 0
                ? 'No se encontraron movimientos'
                : 'Ningún movimiento coincide con la búsqueda'}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
