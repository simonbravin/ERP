'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { COList, type ChangeOrderRow } from './co-list'
import { Button } from '@/components/ui/button'
import { ListFiltersBar } from '@/components/list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ChangeOrdersListClientProps = {
  projectId: string
  orders: ChangeOrderRow[]
  canEdit: boolean
}

export function ChangeOrdersListClient({
  projectId,
  orders,
  canEdit,
}: ChangeOrdersListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams.get('status') ?? ''

  function setFilter(newStatus: string) {
    const p = new URLSearchParams()
    if (newStatus) p.set('status', newStatus)
    router.push(`/projects/${projectId}/change-orders?${p.toString()}`)
    router.refresh()
  }

  function clearFilters() {
    setFilter('')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Change orders
        </h2>
        {canEdit && (
          <Link href={`/projects/${projectId}/change-orders/new`}>
            <Button type="button">New change order</Button>
          </Link>
        )}
      </div>
      <ListFiltersBar onClear={clearFilters}>
        <Select value={status || 'all'} onValueChange={(v) => setFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="CHANGES_REQUESTED">Changes requested</SelectItem>
          </SelectContent>
        </Select>
      </ListFiltersBar>
      <COList projectId={projectId} orders={orders} canEdit={canEdit} />
    </div>
  )
}
