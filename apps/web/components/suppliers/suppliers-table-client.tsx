'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
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
import { Search } from 'lucide-react'

export type SupplierTableRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  type: 'SUPPLIER' | 'CLIENT'
  isGlobal: boolean
  detailHref: string
}

interface SuppliersTableClientProps {
  rows: SupplierTableRow[]
}

export function SuppliersTableClient({ rows }: SuppliersTableClientProps) {
  const t = useTranslations('suppliers')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'SUPPLIER' | 'CLIENT'>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchType =
        typeFilter === 'all' ||
        row.type === typeFilter
      const matchSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        (row.email?.toLowerCase().includes(q) ?? false) ||
        (row.city?.toLowerCase().includes(q) ?? false)
      return matchType && matchSearch
    })
  }, [rows, search, typeFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">{t('search')}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-full sm:w-40">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">{t('typeFilter')}</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'SUPPLIER' | 'CLIENT')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">{t('typeAll')}</option>
            <option value="SUPPLIER">{t('typeSuppliers')}</option>
            <option value="CLIENT">{t('typeClients')}</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? t('noLocalSuppliers')
              : t('noDirectoryResults')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('email')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('phone')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('city')}</TableHead>
                <TableHead className="w-24">{t('typeFilter')}</TableHead>
                <TableHead className="w-20 text-center">{t('globalColumn')}</TableHead>
                <TableHead className="w-24">{t('viewDetails')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link href={row.detailHref} className="hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {row.email ?? '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {row.phone ?? '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {row.city ?? '—'}
                  </TableCell>
                  <TableCell>
                    {row.type === 'SUPPLIER' ? t('typeSuppliers') : t('typeClients')}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {row.isGlobal ? 'Sí' : 'No'}
                  </TableCell>
                  <TableCell>
                    <Link href={row.detailHref}>
                      <Button variant="outline" size="sm">
                        {t('viewDetails')}
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
