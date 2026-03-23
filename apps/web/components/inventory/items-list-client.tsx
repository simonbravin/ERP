'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Grid3x3, List, Package } from 'lucide-react'
import { ListFiltersBar } from '@/components/list'
import { ItemsTable } from './items-table'
import { ItemsGrid } from './items-grid'
import { Link } from '@/i18n/navigation'
import { useMessageBus } from '@/hooks/use-message-bus'

interface ItemRow {
  id: string
  sku: string
  name: string
  description?: string | null
  category: { id: string; name: string }
  subcategory?: { id: string; name: string } | null
  unit: string
  minStockQty?: unknown
  reorderQty?: unknown
  current_stock: unknown
  last_purchase_cost?: unknown
  last_movement_date?: string | Date | null
}

interface ItemsListClientProps {
  items: ItemRow[]
  categories: { id: string; name: string }[]
}

export function ItemsListClient({ items, categories }: ItemsListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('category') ?? '')
  const [stockFilter, setStockFilter] = useState(searchParams.get('stock') ?? '')

  useMessageBus('INVENTORY_ITEM.CREATED', () => router.refresh())
  useMessageBus('INVENTORY_ITEM.UPDATED', () => router.refresh())
  useMessageBus('INVENTORY_ITEM.DELETED', () => router.refresh())
  useMessageBus('INVENTORY_MOVEMENT.CREATED', () => router.refresh())

  function handleSearch() {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (selectedCategoryId) params.set('category', selectedCategoryId)
    if (stockFilter) params.set('stock', stockFilter)
    router.push(`/inventory/items?${params.toString()}`)
  }

  function handleClearFilters() {
    setSearch('')
    setSelectedCategoryId('')
    setStockFilter('')
    router.push('/inventory/items')
  }

  return (
    <div className="space-y-6">
      <ListFiltersBar onApply={handleSearch} onClear={handleClearFilters}>
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por SKU o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-9 pl-9"
          />
        </div>
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-card px-3 py-2 text-sm dark:bg-background"
        >
          <option value="">Todas</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="flex h-9 min-w-[120px] rounded-md border border-input bg-card px-3 py-2 text-sm dark:bg-background"
        >
          <option value="">Todos</option>
          <option value="ok">Stock OK</option>
          <option value="low">Stock Bajo</option>
          <option value="zero">Sin Stock</option>
        </select>
      </ListFiltersBar>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <List className="mr-2 h-4 w-4" />
            Tabla
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 className="mr-2 h-4 w-4" />
            Tarjetas
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <Package className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">No se encontraron items</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/inventory/items/new">Crear Primer Item</Link>
          </Button>
        </div>
      ) : viewMode === 'table' ? (
        <ItemsTable items={items} />
      ) : (
        <ItemsGrid items={items} />
      )}
    </div>
  )
}
