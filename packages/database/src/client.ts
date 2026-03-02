import { PrismaClient } from '@prisma/client'

// Neon–Vercel integration sets DATABASE_URL_UNPOOLED; Prisma expects DIRECT_URL
if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL_UNPOOLED?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED
}

// Fallbacks in case the host uses a different env var name (e.g. POSTGRES_URL, PRIMARY_DATABASE_URL)
if (!process.env.DATABASE_URL?.trim() && process.env.POSTGRES_URL?.trim()) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL
}
if (!process.env.DATABASE_URL?.trim() && process.env.PRIMARY_DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = process.env.PRIMARY_DATABASE_URL
}

// Fail fast in production on the SERVER only (browser: no throw; next build: no throw; Vercel runtime: throw if missing).
const isServer = typeof window === 'undefined'
const isVercelRuntime = process.env.VERCEL === '1'
if (isServer && process.env.NODE_ENV === 'production' && isVercelRuntime && !process.env.DATABASE_URL?.trim()) {
  const vercelEnv = process.env.VERCEL_ENV ?? 'production'
  throw new Error(
    `DATABASE_URL is required in production. In Vercel: Project Settings → Environment Variables → add DATABASE_URL for "${vercelEnv}". If you use Neon’s integration, use the same Vercel project that serves this domain and assign vars to Production. Value = raw URL only (postgresql://...), no "psql \'" prefix or quotes. Then redeploy.`
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
