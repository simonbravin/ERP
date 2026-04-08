import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  reactStrictMode: true,
  transpilePackages: ['@repo/validators', '@svar-ui/react-gantt'],

  serverExternalPackages: ['@prisma/client', '@sparticuz/chromium', 'puppeteer-core'],

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

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...(config.plugins ?? []), new PrismaPlugin()]
    }
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

export default withNextIntl(nextConfig)
