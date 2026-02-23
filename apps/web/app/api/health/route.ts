import { prisma } from '@repo/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Unauthenticated. Used by uptime monitors and Vercel deployment health checks.
 * Verifies the app is running and the database is reachable.
 */
export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json(
      { status: 'ok', db: 'ok', timestamp },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json(
      { status: 'error', db: 'error', timestamp, message },
      { status: 500 }
    )
  }
}
