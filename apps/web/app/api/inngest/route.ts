import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { eventDispatcher } from '@/inngest/functions/event-dispatcher'
import { weeklyReport } from '@/inngest/functions/weekly-report'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [eventDispatcher, weeklyReport],
})
