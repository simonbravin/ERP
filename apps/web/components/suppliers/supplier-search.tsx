'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlobalSupplierCard } from './global-supplier-card'

type GlobalParty = {
  id: string
  name: string
  category: string
  description: string | null
  verified: boolean
  avgRating?: unknown
  reviewCount?: number
  orgCount?: number
  countries?: string[]
  regions?: string[]
}

type SupplierSearchProps = {
  initialResults: GlobalParty[]
}

export function SupplierSearch({ initialResults }: SupplierSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (query.trim()) {
      params.set('q', query.trim())
    } else {
      params.delete('q')
    }
    params.set('tab', 'directory')
    router.push(`/suppliers?${params.toString()}`)
  }

  return (
    <div className="w-full space-y-4">
      <form onSubmit={handleSearch} className="erp-search-row">
        <div className="erp-search-input-wrap">
          <Input
            type="search"
            placeholder="Search by name or category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="erp-search-input"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {initialResults.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No suppliers found. Try a different search or browse all.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialResults.map((supplier) => (
            <GlobalSupplierCard
              key={supplier.id}
              supplier={supplier}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}
