import { inngest } from '@/inngest/client'
import { prisma } from '@repo/database'
import { buildWeeklyReportPayload } from '@/app/actions/finance-weekly-report'
import { buildWeeklyReportHtml } from '@/lib/weekly-report-email'
import { sendWeeklyReportEmail } from '@/lib/email'

/**
 * Weekly report email: every Friday at 9:00 (Argentina). Sends to all OWNERs of each org.
 * Requires WEEKLY_REPORT_ENABLED=true and RESEND_API_KEY.
 */
export const weeklyReport = inngest.createFunction(
  {
    id: 'weekly-report',
    name: 'Weekly Report Email',
    retries: 0,
  },
  { cron: 'TZ=America/Argentina/Buenos_Aires 0 9 * * 5' },
  async ({ step }) => {
    const enabled = process.env.WEEKLY_REPORT_ENABLED === 'true'
    if (!enabled) {
      return { skipped: true, reason: 'WEEKLY_REPORT_ENABLED is not true' }
    }

    const orgs = await step.run('fetch-orgs', async () => {
      const list = await prisma.organization.findMany({
        where: { active: true },
        select: { id: true },
      })
      return list.map((o) => o.id)
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ''
    const reportDate = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const subject = `Bloqer – Resumen semanal del ${reportDate}`

    let sent = 0
    let errors: string[] = []

    for (const orgId of orgs) {
      const owners = await step.run(`owners-${orgId}`, async () => {
        const members = await prisma.orgMember.findMany({
          where: { orgId, role: 'OWNER', active: true },
          include: { user: { select: { email: true } } },
        })
        return members.map((m) => m.user.email).filter((e): e is string => Boolean(e?.trim()))
      })

      if (owners.length === 0) continue

      const payload = await step.run(`payload-${orgId}`, async () => {
        return buildWeeklyReportPayload(orgId)
      })

      if (!payload) continue

      const contentHtml = buildWeeklyReportHtml(payload, appUrl)

      for (const to of owners) {
        const result = await step.run(`send-${orgId}-${to}`, async () => {
          return sendWeeklyReportEmail({ to, subject, contentHtml })
        })
        if (result.success) sent += 1
        else errors.push(`${orgId}:${to}: ${(result.error as { message?: string }).message ?? 'unknown'}`)
      }
    }

    return { sent, errors: errors.length > 0 ? errors : undefined }
  }
)
