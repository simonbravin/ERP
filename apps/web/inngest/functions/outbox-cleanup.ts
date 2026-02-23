import { inngest } from '@/inngest/client'
import { prisma } from '@repo/database'

const BATCH_SIZE = 5_000
const COMPLETED_TTL_DAYS = 7 // Delete COMPLETED events older than this many days

/**
 * Daily cleanup job for the OutboxEvent table.
 *
 * Problem: OutboxEvent rows are never deleted. At scale (100 orgs × 50 users ×
 * 20 mutations/day) the table grows ~100,000 rows/day — indefinitely.
 *
 * Solution: delete COMPLETED rows older than 7 days in batches of 5,000 to
 * avoid long-running transactions or lock contention on the table.
 *
 * FAILED rows are intentionally NOT deleted — they require manual review.
 * Register an Inngest alert for FAILED events in the Inngest dashboard.
 *
 * Runs daily at 03:00 UTC (low-traffic window for LatAm tenants).
 */
export const outboxEventCleanup = inngest.createFunction(
  {
    id: 'outbox-event-cleanup',
    name: 'Limpiar OutboxEvents completados',
    retries: 2,
  },
  { cron: '0 3 * * *' }, // daily at 03:00 UTC
  async ({ step, logger }) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - COMPLETED_TTL_DAYS)

    let totalDeleted = 0
    let batchNumber = 0

    // Loop in batches until no more rows match the filter.
    // This prevents a single DELETE from locking the table for too long.
    while (true) {
      batchNumber++

      const deleted = await step.run(`delete-batch-${batchNumber}`, async () => {
        // Postgres: DELETE ... WHERE id IN (SELECT id ... LIMIT n) is the
        // idiomatic way to batch-delete without a separate SELECT + loop.
        const result = await prisma.$executeRaw`
          DELETE FROM public.outbox_events
          WHERE id IN (
            SELECT id FROM public.outbox_events
            WHERE status = 'COMPLETED'
              AND created_at < ${cutoff}
            LIMIT ${BATCH_SIZE}
          )
        `
        return result // number of rows deleted
      })

      totalDeleted += deleted

      if (deleted < BATCH_SIZE) {
        // Fewer than a full batch were deleted — no more rows to process.
        break
      }

      // Short pause between batches to yield I/O to other queries.
      await step.sleep(`pause-after-batch-${batchNumber}`, '500ms')
    }

    logger.info('[outbox-cleanup] limpieza completada', {
      totalDeleted,
      batches: batchNumber,
      cutoffDate: cutoff.toISOString(),
      ttlDays: COMPLETED_TTL_DAYS,
    })

    return {
      totalDeleted,
      batches: batchNumber,
      cutoffDate: cutoff.toISOString(),
    }
  }
)
