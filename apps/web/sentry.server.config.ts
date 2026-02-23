import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Capture 10% of traces in production to limit quota usage.
  // Increase once baseline performance is understood.
  tracesSampleRate: 0.1,

  // No debug output in production logs.
  debug: false,
})
