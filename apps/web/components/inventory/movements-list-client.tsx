'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
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
import { enUS, es as esLocale } from 'date-fns/locale'
import { formatCurrency } from '@/lib/format-utils'
import {
  ShoppingCart,
  ArrowRightLeft,
  Minus,
  Plus,
  ArrowRight,
  Search,
  ChevronDown,
} from 'lucide-react'
import { ListFiltersBar } from '@/components/list'
import type { InventoryMovementClientRow } from '@/lib/types/inventory-dto'

interface MovementsListClientProps {
  movements: InventoryMovementClientRow[]
  items: Array<{ id: string; sku: string; name: string }>
  locations: Array<{ id: string; name: string }>
}

const MOVEMENT_TYPE_IDS = ['PURCHASE', 'TRANSFER', 'ISSUE', 'ADJUSTMENT'] as const

const movementTypeIcons: Record<
  string,
  { icon: typeof ShoppingCart; variant: 'success' | 'info' | 'warning' | 'neutral' }
> = {
  PURCHASE: { icon: ShoppingCart, variant: 'success' },
  TRANSFER: { icon: ArrowRightLeft, variant: 'info' },
  ISSUE: { icon: Minus, variant: 'warning' },
  ADJUSTMENT: { icon: Plus, variant: 'neutral' },
}

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
  emptyMessage = 'Sin resultados',
  partialSelectionLabel,
}: {
  label: string
  options: { id: string; label: string }[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  searchPlaceholder?: string
  allLabel?: string
  emptyMessage?: string
  partialSelectionLabel?: (count: number) => string
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
        : partialSelectionLabel
          ? partialSelectionLabel(selectedIds.length)
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
                {emptyMessage}
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
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const dateFnsLocale = locale.startsWith('es') ? esLocale : enUS
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

  const movementTypeOptions = MOVEMENT_TYPE_IDS.map((id) => ({
    id,
    label: t(`movementTypes.${id}`),
  }))

  function movementTypeLabel(code: string): string {
    if ((MOVEMENT_TYPE_IDS as readonly string[]).includes(code)) {
      return t(`movementTypes.${code}` as 'movementTypes.PURCHASE')
    }
    return code
  }

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
    const typeMatches = (code: string) => {
      const lab = (MOVEMENT_TYPE_IDS as readonly string[]).includes(code)
        ? t(`movementTypes.${code}` as 'movementTypes.PURCHASE')
        : code
      return lab.toLowerCase().includes(q)
    }
    return movements.filter((m) => {
      const itemMatch =
        m.item.name.toLowerCase().includes(q) ||
        m.item.sku.toLowerCase().includes(q)
      const fromMatch = m.fromLocation?.name?.toLowerCase().includes(q)
      const toMatch = m.toLocation?.name?.toLowerCase().includes(q)
      return itemMatch || fromMatch || toMatch || typeMatches(m.movementType)
    })
  }, [movements, searchQuery, t])

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('movementsSearchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ListFiltersBar onClear={handleClearFilters}>
        <div className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-5">
          <FilterMultiSelect
            label={t('filterMovementType')}
            options={movementTypeOptions}
            selectedIds={typeIds}
            onSelectionChange={(ids) => updateUrl({ type: ids })}
            searchPlaceholder={t('searchTypePlaceholder')}
            allLabel={tCommon('all')}
            emptyMessage={tCommon('noResults')}
            partialSelectionLabel={(count) => t('filterSelectedCount', { count })}
          />
          <FilterMultiSelect
            label={t('filterItem')}
            options={itemOptions}
            selectedIds={itemIds}
            onSelectionChange={(ids) => updateUrl({ itemId: ids })}
            searchPlaceholder={t('searchItemPlaceholder')}
            allLabel={tCommon('all')}
            emptyMessage={tCommon('noResults')}
            partialSelectionLabel={(count) => t('filterSelectedCount', { count })}
          />
          <FilterMultiSelect
            label={t('filterLocation')}
            options={locationOptions}
            selectedIds={locationIds}
            onSelectionChange={(ids) => updateUrl({ locationId: ids })}
            searchPlaceholder={t('searchLocationPlaceholder')}
            allLabel={t('allLocations')}
            emptyMessage={tCommon('noResults')}
            partialSelectionLabel={(count) => t('filterSelectedCount', { count })}
          />
          <div>
            <label className="mb-2 block text-sm font-medium">{t('filterDateFrom')}</label>
            <Input
              type="date"
              value={fromParam}
              onChange={(e) => updateUrl({ from: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">{t('filterDateTo')}</label>
            <Input
              type="date"
              value={toParam}
              onChange={(e) => updateUrl({ to: e.target.value })}
            />
          </div>
        </div>
      </ListFiltersBar>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr className="text-left text-sm">
                <th className="p-4 font-medium">{t('movementsColDate')}</th>
                <th className="p-4 font-medium">{t('movementsColType')}</th>
                <th className="p-4 font-medium">{t('movementsColItem')}</th>
                <th className="p-4 font-medium">{t('movementsColFrom')}</th>
                <th className="p-4 font-medium" aria-hidden />
                <th className="p-4 font-medium">{t('movementsColTo')}</th>
                <th className="p-4 text-right font-medium">{t('movementsColQuantity')}</th>
                <th className="p-4 text-right font-medium">{t('movementsColUnitCost')}</th>
                <th className="p-4 text-right font-medium">{t('movementsColTotal')}</th>
                <th className="p-4 font-medium">{t('movementsColUser')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBySearch.map((movement) => {
                const typeInfo =
                  movementTypeIcons[movement.movementType] ??
                  movementTypeIcons.ADJUSTMENT
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
                        locale: dateFnsLocale,
                      })}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={typeInfo.variant}
                        className="inline-flex items-center gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {movementTypeLabel(movement.movementType)}
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
                      {movement.createdBy?.user?.fullName ?? t('movementSystemUser')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredBySearch.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              {movements.length === 0 ? t('noMovements') : t('noMovementsMatchSearch')}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
