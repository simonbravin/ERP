import * as Sentry from '@sentry/nextjs'

/**
 * Next.js instrumentation hook — called once when the server worker starts.
 * Initialises Sentry for the correct runtime (Node.js server or Edge).
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * Automatically capture server-side request errors (App Router).
 * This hook is called by Next.js 15 for every unhandled request error.
 */
export const onRequestError = Sentry.captureRequestError
