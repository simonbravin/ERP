'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[super-admin]', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="max-w-lg border-destructive/30">
        <CardHeader>
          <CardTitle>Error en Super Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Ocurrió un error al cargar esta sección. Si acabás de desplegar billing, verificá que las migraciones de Prisma estén aplicadas en Neon.</p>
          {error.digest ? (
            <p className="font-mono text-xs text-foreground">
              Digest: <span className="select-all">{error.digest}</span>
            </p>
          ) : null}
          <Button type="button" onClick={() => reset()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
