import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of traces. Adjust as traffic grows.
  tracesSampleRate: 0.1,

  // No debug output in the browser console.
  debug: false,

  // Capture session replays only on errors (no session overhead in normal flows).
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  integrations: [Sentry.replayIntegration()],
})
