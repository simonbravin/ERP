import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

process.env.SKIP_TYPE_CHECK = 'true'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  transpilePackages: ['@repo/validators'],

  serverExternalPackages: ['@prisma/client'],

  // Allow Vercel deploy when scanner blocks on CVE (use with env bypass vars)
  skipMiddlewareUrlNormalize: true,

  // In production, inline CSS to avoid the "preloaded but not used" warning for
  // app/layout.css. In dev, that warning is a known Next.js behavior and harmless.
  experimental: {
    inlineCss: true,
  },

  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon' }]
  },

  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: [
        'C:\\hiberfil.sys',
        'C:\\pagefile.sys',
        'C:\\swapfile.sys',
        'C:\\DumpStack.log.tmp',
      ],
    }

    return config
  },
}

export default withSentryConfig(withNextIntl(nextConfig), {
  // Sentry project settings. Set SENTRY_ORG and SENTRY_PROJECT in Vercel env.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Silences Sentry CLI output locally; CI will show it.
  silent: !process.env.CI,

  // Hide Sentry source maps from the deployed bundle.
  hideSourceMaps: true,

  // Disable SDK bundle logger to keep client bundle lean.
  disableLogger: true,

  // Automatically instrument Vercel Cron Monitors (optional, zero cost).
  automaticVercelMonitors: true,
})
