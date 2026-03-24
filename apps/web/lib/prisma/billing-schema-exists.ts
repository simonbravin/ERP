import { prisma } from '@repo/database'

/** True if `public.organization_subscriptions` exists (proxy for full billing DDL applied). */
export async function billingCoreTablesExist(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'organization_subscriptions'
    ) AS "exists"
  `
  return rows[0]?.exists === true
}
