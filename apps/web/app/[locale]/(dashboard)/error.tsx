'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const locale = typeof params.locale === 'string' ? params.locale : 'es'

  useEffect(() => {
    console.error('Dashboard segment error:', error)
  }, [error])

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch justify-center bg-background px-4 py-10 sm:px-6">
      <div className="erp-card mx-auto w-full max-w-2xl p-6 sm:p-8">
        <h1 className="erp-page-title">Algo salió mal</h1>
        <p className="mt-2 erp-section-desc max-w-prose">
          No se pudo cargar esta página. Puedes intentar de nuevo o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={reset}>
            Reintentar
          </Button>
          <Button variant="default" asChild>
            <Link href={`/${locale}/dashboard`}>Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
