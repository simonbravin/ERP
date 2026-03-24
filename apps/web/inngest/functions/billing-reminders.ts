import { inngest } from '@/inngest/client'
import { prisma } from '@repo/database'
import { sendBillingReminderEmail } from '@/lib/email'
import { createInAppNotificationsForUsers } from '@/app/actions/notifications'
import { BILLING_REMINDER_CATEGORY } from '@/lib/billing/constants'

export const billingReminders = inngest.createFunction(
  {
    id: 'billing-reminders',
    name: 'Billing Reminders',
    retries: 0,
  },
  { cron: 'TZ=America/Argentina/Buenos_Aires 0 10 * * *' },
  async ({ step }) => {
    if (process.env.BILLING_REMINDERS_ENABLED !== 'true') {
      return { skipped: true, reason: 'BILLING_REMINDERS_ENABLED is not true' }
    }

    const now = new Date()
    const trialSoon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const subscriptions = await step.run('fetch-billing-reminders-targets', async () => {
      return prisma.organizationSubscription.findMany({
        where: {
          OR: [
            { status: 'TRIALING', trialEnd: { lte: trialSoon, gte: now } },
            { status: 'PAST_DUE' },
          ],
        },
        include: {
          organization: {
            include: {
              members: {
                where: { active: true, role: { in: ['OWNER', 'ADMIN'] } },
                include: { user: { select: { id: true, email: true } } },
              },
            },
          },
        },
      })
    })

    let sent = 0
    for (const sub of subscriptions) {
      const recipients = sub.organization.members.map((m) => m.user).filter((u) => Boolean(u.email?.trim()))
      if (recipients.length === 0) continue
      const subject =
        sub.status === 'PAST_DUE'
          ? `Bloqer: pago pendiente en ${sub.organization.name}`
          : `Bloqer: tu trial termina pronto (${sub.organization.name})`
      const contentHtml =
        sub.status === 'PAST_DUE'
          ? '<p>Detectamos un pago pendiente. Tu organización puede entrar en modo lectura si no se regulariza.</p>'
          : '<p>Tu período de prueba está por finalizar. Actualizá tu plan para evitar restricciones.</p>'

      for (const recipient of recipients) {
        const result = await step.run(`send-billing-reminder-${sub.id}-${recipient.id}`, async () => {
          return sendBillingReminderEmail({
            to: recipient.email!,
            subject,
            contentHtml,
          })
        })
        if (result.success) sent += 1
      }

      await step.run(`create-in-app-${sub.id}`, async () => {
        await createInAppNotificationsForUsers(
          recipients.map((r) => r.id),
          {
            orgId: sub.orgId,
            category:
              sub.status === 'PAST_DUE'
                ? BILLING_REMINDER_CATEGORY.PAYMENT_FAILED
                : BILLING_REMINDER_CATEGORY.TRIAL_ENDING,
            title: sub.status === 'PAST_DUE' ? 'Pago pendiente' : 'Trial por vencer',
            message:
              sub.status === 'PAST_DUE'
                ? 'Tu organización tiene un pago pendiente.'
                : 'Tu período de prueba termina en los próximos días.',
            metadata: { link: '/settings/subscription' },
          }
        )
      })
    }

    return { sent, subscriptions: subscriptions.length }
  }
)
