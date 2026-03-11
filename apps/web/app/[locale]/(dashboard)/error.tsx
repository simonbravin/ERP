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
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">
          Algo salió mal
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No se pudo cargar esta página. Puedes intentar de nuevo o volver al inicio.
        </p>
        <div className="mt-6 flex gap-3">
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
