import { NextResponse } from 'next/server'

/**
 * GET /api/env-check
 * Diagnóstico: indica si el runtime tiene DATABASE_URL (sin revelar el valor).
 * Usar en producción para confirmar que las env vars llegan al deployment.
 */
export async function GET() {
  const databaseUrlSet = Boolean(
    process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_URL?.trim() ||
      process.env.PRIMARY_DATABASE_URL?.trim()
  )
  const directUrlSet = Boolean(
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL_UNPOOLED?.trim()
  )
  return NextResponse.json(
    {
      databaseUrlSet,
      directUrlSet,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      nodeEnv: process.env.NODE_ENV,
    },
    { status: 200 }
  )
}
