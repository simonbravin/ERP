'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Search, List, Grid3x3, Building2, Pencil, ArrowUpDown } from 'lucide-react'
import { SupplierSearch } from './supplier-search'
import { GlobalSupplierCard } from './global-supplier-card'
import { PartyDetailDialog } from './party-detail-dialog'

type LinkedSupplier = {
  id: string
  localAlias: string | null
  preferred: boolean
  localContactName: string | null
  globalParty: {
    id: string
    name: string
    category: string
    verified: boolean
  }
}

type LocalSupplier = {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  category?: string | null
}

type GlobalParty = {
  id: string
  name: string
  category: string
  description: string | null
  verified: boolean
  avgRating: unknown
  reviewCount: number
  orgCount: number
  countries: string[]
  regions: string[]
}

type SuppliersListClientProps = {
  defaultTab: string
  linkedSuppliers: LinkedSupplier[]
  localSuppliers: LocalSupplier[]
  localClients: LocalSupplier[]
  globalSearchResults: GlobalParty[]
  canAddLocal: boolean
  canEditLocal: boolean
}

export function SuppliersListClient({
  defaultTab,
  linkedSuppliers,
  localSuppliers,
  localClients,
  globalSearchResults,
  canEditLocal,
}: SuppliersListClientProps) {
  const t = useTranslations('suppliers')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') ?? '')
  const filterParam = searchParams.get('filter') as 'all' | 'suppliers' | 'clients' | null
  const [localPartyTypeFilter, setLocalPartyTypeFilter] = useState<'all' | 'suppliers' | 'clients'>(
    filterParam === 'suppliers' || filterParam === 'clients' ? filterParam : 'all'
  )
  const currentTab = (searchParams.get('tab') as 'linked' | 'local' | 'directory') || defaultTab
  const [detailPartyId, setDetailPartyId] = useState<string | null>(null)
  const [localSortBy, setLocalSortBy] = useState<'name' | 'category' | null>(null)

  const categories = Array.from(
    new Set([
      ...linkedSuppliers.map((l) => l.globalParty.category),
      ...globalSearchResults.map((g) => g.category),
      ...localSuppliers.map((s) => s.category).filter(Boolean),
      ...localClients.map((s) => s.category).filter(Boolean),
    ])
  ).filter(Boolean).sort()

  const qLower = search.trim().toLowerCase()
  const filteredLinked = qLower || selectedCategory
    ? linkedSuppliers.filter((link) => {
        const matchSearch = !qLower || (link.localAlias ?? link.globalParty.name).toLowerCase().includes(qLower) || link.globalParty.category.toLowerCase().includes(qLower)
        const matchCategory = !selectedCategory || link.globalParty.category === selectedCategory
        return matchSearch && matchCategory
      })
    : linkedSuppliers
  const localSuppliersFilteredBySearch = qLower
    ? localSuppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(qLower) ||
          (s.email?.toLowerCase().includes(qLower) ?? false) ||
          (s.city?.toLowerCase().includes(qLower) ?? false)
      )
    : localSuppliers
  const localClientsFilteredBySearch = qLower
    ? localClients.filter(
        (s) =>
          s.name.toLowerCase().includes(qLower) ||
          (s.email?.toLowerCase().includes(qLower) ?? false) ||
          (s.city?.toLowerCase().includes(qLower) ?? false)
      )
    : localClients
  type LocalPartyItem = LocalSupplier & { partyType: 'SUPPLIER' | 'CLIENT' }
  const localSuppliersWithType = localSuppliersFilteredBySearch.map((s) => ({ ...s, partyType: 'SUPPLIER' as const }))
  const localClientsWithType = localClientsFilteredBySearch.map((s) => ({ ...s, partyType: 'CLIENT' as const }))
  const mergedLocal: LocalPartyItem[] =
    localPartyTypeFilter === 'suppliers'
      ? localSuppliersWithType
      : localPartyTypeFilter === 'clients'
        ? localClientsWithType
        : [...localSuppliersWithType, ...localClientsWithType].sort((a, b) => a.name.localeCompare(b.name))
  const filteredLocalByType = selectedCategory
    ? mergedLocal.filter((s) => (s.category ?? '') === selectedCategory)
    : mergedLocal
  const filteredLocal = filteredLocalByType
  const sortedLocal =
    localSortBy === 'name'
      ? [...filteredLocal].sort((a, b) => a.name.localeCompare(b.name))
      : localSortBy === 'category'
        ? [...filteredLocal].sort((a, b) =>
            (a.category ?? '').localeCompare(b.category ?? '')
          )
        : filteredLocal

  function handleSearch() {
    const params = new URLSearchParams(searchParams.toString())
    if (search.trim()) params.set('q', search.trim())
    else params.delete('q')
    if (selectedCategory) params.set('category', selectedCategory)
    else params.delete('category')
    if (!params.get('tab')) params.set('tab', defaultTab)
    router.push(`/suppliers/list?${params.toString()}`)
  }

  function handleClearFilters() {
    setSearch('')
    setSelectedCategory('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.delete('category')
    const tab = params.get('tab') || defaultTab
    router.push(`/suppliers/list?tab=${tab}`)
  }

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    if (search.trim()) params.set('q', search.trim())
    if (selectedCategory) params.set('category', selectedCategory)
    router.push(`/suppliers/list?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch}>{t('filter')}</Button>
        <Button variant="outline" onClick={handleClearFilters}>
          {t('clearFilters')}
        </Button>
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-card dark:bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('debtFilterAll')}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <div className="flex flex-wrap items-center gap-4">
          <TabsList>
            <TabsTrigger value="linked">
              {t('linked')} ({linkedSuppliers.length})
            </TabsTrigger>
            <TabsTrigger value="local">
              {t('myDirectory', { defaultValue: 'Mi directorio' })} ({localSuppliers.length + localClients.length})
            </TabsTrigger>
            <TabsTrigger value="directory">{t('global')}</TabsTrigger>
          </TabsList>
          <div className="flex gap-2 ml-auto">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <List className="mr-2 h-4 w-4" />
              {t('table')}
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="mr-2 h-4 w-4" />
              {t('cards')}
            </Button>
          </div>
        </div>

        <TabsContent value="linked" className="mt-4">
          {filteredLinked.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">{t('noLinkedSuppliers')}</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/suppliers/list?tab=directory">{t('global')}</Link>
              </Button>
            </div>
          ) : viewMode === 'table' ? (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">{t('name')}</TableHead>
                    <TableHead className="w-[140px]">{t('category')}</TableHead>
                    <TableHead className="w-[100px]">{t('verified')}</TableHead>
                    <TableHead className="w-[100px]">{t('preferred')}</TableHead>
                    <TableHead>{t('contact')}</TableHead>
                    <TableHead className="w-[120px]">{t('view')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLinked.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/suppliers/global/${link.globalParty.id}`}
                          className="hover:underline text-foreground"
                        >
                          {link.localAlias || link.globalParty.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {link.globalParty.category.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>
                        {link.globalParty.verified ? (
                          <span className="text-xs text-status-info">{t('verified')}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {link.preferred ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                            {t('preferred')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {link.localContactName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/suppliers/global/${link.globalParty.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {t('view')} →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLinked.map((link) => (
                <Card key={link.id} className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">
                          <Link
                            href={`/suppliers/global/${link.globalParty.id}`}
                            className="hover:underline text-foreground"
                          >
                            {link.localAlias || link.globalParty.name}
                          </Link>
                        </h3>
                        {link.globalParty.verified && (
                          <span className="text-xs text-status-info">{t('verified')}</span>
                        )}
                      </div>
                      {link.preferred && (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs">
                          {t('preferred')}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {link.globalParty.category.replace(/_/g, ' ')}
                    </p>
                    {link.localContactName && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('contact')}: {link.localContactName}
                      </p>
                    )}
                    <Link
                      href={`/suppliers/global/${link.globalParty.id}`}
                      className="mt-3 inline-block text-sm text-primary hover:underline"
                    >
                      {t('view')} →
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="local" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t('typeFilter')}:</span>
            <div className="flex gap-2">
              <Button
                variant={localPartyTypeFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setLocalPartyTypeFilter('all')}
              >
                {t('typeAll')}
              </Button>
              <Button
                variant={localPartyTypeFilter === 'suppliers' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setLocalPartyTypeFilter('suppliers')}
              >
                {t('typeSuppliers')}
              </Button>
              <Button
                variant={localPartyTypeFilter === 'clients' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setLocalPartyTypeFilter('clients')}
              >
                {t('typeClients')}
              </Button>
            </div>
          </div>
          {filteredLocal.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">{t('noLocalSuppliers')}</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/suppliers/local/new">{t('addLocalSupplier')}</Link>
              </Button>
            </div>
          ) : (
            <>
              {viewMode === 'table' ? (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">
                      <button
                        type="button"
                        onClick={() => setLocalSortBy((prev) => (prev === 'name' ? null : 'name'))}
                        className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                      >
                        {t('name')}
                        {localSortBy === 'name' && <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <button
                        type="button"
                        onClick={() => setLocalSortBy((prev) => (prev === 'category' ? null : 'category'))}
                        className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
                      >
                        {t('category')}
                        {localSortBy === 'category' && <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('phone')}</TableHead>
                    <TableHead>{t('city')}</TableHead>
                    {canEditLocal && (
                      <TableHead className="w-[100px] text-right">{t('edit')}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLocal.map((s) => (
                    <TableRow key={`${s.partyType}-${s.id}`}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => setDetailPartyId(s.id)}
                          className="hover:underline text-foreground text-left font-medium"
                        >
                          {s.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.category ? s.category.replace(/_/g, ' ') : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.email ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{s.phone ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{s.city ?? '—'}</TableCell>
                      {canEditLocal && (
                        <TableCell className="text-right">
                          <Link
                            href={`/suppliers/local/${s.id}/edit`}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Pencil className="h-4 w-4" />
                            {t('edit')}
                          </Link>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
              ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedLocal.map((s) => (
                <Card key={`${s.partyType}-${s.id}`} className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">
                        <button
                          type="button"
                          onClick={() => setDetailPartyId(s.id)}
                          className="hover:underline text-foreground text-left"
                        >
                          {s.name}
                        </button>
                      </h3>
                      {canEditLocal && (
                        <Link
                          href={`/suppliers/local/${s.id}/edit`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                        >
                          <Pencil className="h-4 w-4" />
                          {t('edit')}
                        </Link>
                      )}
                    </div>
                    {s.category && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('category')}: {s.category.replace(/_/g, ' ')}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">{t('email')}: {s.email ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">{t('phone')}: {s.phone ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">{t('city')}: {s.city ?? '—'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
              )}
            </>
          )}
        </TabsContent>

        <PartyDetailDialog
          open={!!detailPartyId}
          onOpenChange={(open) => !open && setDetailPartyId(null)}
          partyId={detailPartyId}
          canEdit={canEditLocal}
        />

        <TabsContent value="directory" className="mt-4">
          <SupplierSearch
            key={searchParams.get('q') ?? 'default'}
            initialResults={globalSearchResults}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
