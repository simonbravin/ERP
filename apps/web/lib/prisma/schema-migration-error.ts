import { Prisma } from '@repo/database'

/** True when the DB is missing tables/columns expected by the current Prisma schema (e.g. billing not migrated). */
export function isPrismaSchemaDriftError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') return true
    // Raw query failed — only treat as "missing object" when message is explicit
    if (error.code === 'P2010') {
      const m = error.message.toLowerCase()
      if (m.includes('does not exist')) return true
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return false
  }
  if (error instanceof Error) {
    const m = error.message.toLowerCase()
    if (
      m.includes('relation') &&
      m.includes('does not exist') &&
      (m.includes('organization_subscriptions') ||
        m.includes('billing_') ||
        m.includes('promo_codes') ||
        m.includes('billing_event'))
    ) {
      return true
    }
  }
  return false
}
