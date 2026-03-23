'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { linkGlobalSupplier } from '@/app/actions/global-suppliers'
import { OrgPartyLinkForm } from './org-party-link-form'

type GlobalSupplierDetailProps = {
  supplier: {
    id: string
    name: string
    legalName: string | null
    category: string
    description: string | null
    email: string | null
    phone: string | null
    website: string | null
    verified: boolean
    avgRating: { toNumber?: () => number } | number | null
    reviewCount: number
    orgCount: number
    countries: string[]
    regions: string[]
    certifications: unknown
  }
  isLinked: boolean
  linkId: string | null
}

function formatRating(r: GlobalSupplierDetailProps['supplier']['avgRating']): string {
  if (r == null) return ''
  const n = typeof r === 'number' ? r : r.toNumber?.() ?? 0
  return n > 0 ? n.toFixed(1) : ''
}

export function GlobalSupplierDetail({
  supplier,
  isLinked,
  linkId: _linkId,
}: GlobalSupplierDetailProps) {
  const router = useRouter()
  const [showLinkForm, setShowLinkForm] = useState(false)

  async function handleLinkSuccess() {
    setShowLinkForm(false)
    router.refresh()
  }

  const rating = formatRating(supplier.avgRating)
  const certs =
    Array.isArray(supplier.certifications) ? supplier.certifications : []

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {supplier.name}
            </h1>
            {supplier.legalName && (
              <p className="mt-1 text-sm text-gray-500">{supplier.legalName}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {supplier.verified && (
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  ✓ Verified
                </span>
              )}
              {rating && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  ⭐ {rating}
                  {supplier.reviewCount > 0 && ` (${supplier.reviewCount} reviews)`}
                </span>
              )}
              {supplier.orgCount > 0 && (
                <span className="text-sm text-gray-500">
                  {supplier.orgCount} orgs use this supplier
                </span>
              )}
            </div>
          </div>
          {!isLinked && (
            <Button onClick={() => setShowLinkForm(true)}>
              Link to My Organization
            </Button>
          )}
          {isLinked && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Linked
            </span>
          )}
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Category</dt>
            <dd className="mt-1 text-sm">{supplier.category.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Countries</dt>
            <dd className="mt-1 text-sm">{supplier.countries?.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Regions</dt>
            <dd className="mt-1 text-sm">{supplier.regions?.join(', ') || '—'}</dd>
          </div>
          {supplier.email && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">Email</dt>
              <dd className="mt-1 text-sm">
                <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                  {supplier.email}
                </a>
              </dd>
            </div>
          )}
          {supplier.phone && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm">{supplier.phone}</dd>
            </div>
          )}
          {supplier.website && (
            <div>
              <dt className="text-xs font-medium uppercase text-gray-500">Website</dt>
              <dd className="mt-1 text-sm">
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {supplier.website}
                </a>
              </dd>
            </div>
          )}
        </dl>

        {supplier.description && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {supplier.description}
            </p>
          </div>
        )}

        {certs.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Certifications
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {certs.map((c: string, i: number) => (
                <span
                  key={i}
                  className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLinkForm && !isLinked && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-medium">Link {supplier.name} to your organization</h2>
          <OrgPartyLinkForm
            globalPartyId={supplier.id}
            globalPartyName={supplier.name}
            onSuccess={handleLinkSuccess}
            onCancel={() => setShowLinkForm(false)}
            linkGlobalSupplier={linkGlobalSupplier}
          />
        </div>
      )}
    </div>
  )
}
