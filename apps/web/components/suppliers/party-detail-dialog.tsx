'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Pencil, ShoppingCart, Receipt, Loader2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getPartyDetailWithKpis, type PartyDetailWithKpis } from '@/app/actions/global-suppliers'
import { formatCurrencyForDisplay } from '@/lib/format-utils'

type PartyDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  partyId: string | null
  canEdit: boolean
}

export function PartyDetailDialog({ open, onOpenChange, partyId, canEdit }: PartyDetailDialogProps) {
  const t = useTranslations('suppliers')
  const [data, setData] = useState<PartyDetailWithKpis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !partyId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getPartyDetailWithKpis(partyId)
      .then((result) => {
        if (!cancelled) {
          setData(result ?? null)
          if (!result) setError('No encontrado')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Error al cargar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, partyId])

  const isSupplier = data?.party.partyType === 'SUPPLIER'
  const subtitle = isSupplier ? t('local') : t('totalClients')
  const fields = data
    ? [
        { label: t('name'), value: data.party.name },
        ...(data.party.category
          ? [{ label: t('category'), value: data.party.category.replace(/_/g, ' ') }]
          : []),
        { label: t('taxId'), value: data.party.taxId },
        { label: t('email'), value: data.party.email },
        { label: t('phone'), value: data.party.phone },
        { label: t('address'), value: data.party.address },
        { label: t('city'), value: data.party.city },
        { label: t('country'), value: data.party.country },
        { label: t('website'), value: data.party.website },
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp-form-modal max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{data?.party.name ?? '—'}</DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <p className="py-4 text-sm text-destructive">{error}</p>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {isSupplier && (
                <>
                  <Card className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('totalPurchased')}
                          </p>
                          <p className="text-lg font-semibold tabular-nums">
                            {formatCurrencyForDisplay(data.kpis.totalPurchased ?? 0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('purchaseOrdersCount')}
                          </p>
                          <p className="text-lg font-semibold tabular-nums">
                            {data.kpis.purchaseOrdersCount ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
              {!isSupplier && (
                <>
                  <Card className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('totalSold')}
                          </p>
                          <p className="text-lg font-semibold tabular-nums">
                            {formatCurrencyForDisplay(data.kpis.totalSold ?? 0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('salesCount')}
                          </p>
                          <p className="text-lg font-semibold tabular-nums">
                            {data.kpis.salesCount ?? 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Fields */}
            <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              {fields.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-sm">
                    {value ? (
                      label === t('email') ? (
                        <a
                          href={`mailto:${value}`}
                          className="text-primary hover:underline"
                        >
                          {value}
                        </a>
                      ) : label === t('website') ? (
                        <a
                          href={value.startsWith('http') ? value : `https://${value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {value}
                        </a>
                      ) : (
                        value
                      )
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            {canEdit && data.party.id && (
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button asChild variant="default" size="sm">
                  <Link href={`/suppliers/local/${data.party.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t('edit')}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
