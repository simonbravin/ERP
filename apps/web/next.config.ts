import fs from 'fs'
import path from 'path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** pnpm + monorepo: forzar ruta física para que webpack resuelva en CI/Vercel. */
function resolveSvarReactGanttDir(): string {
  const segments = ['node_modules', '@svar-ui', 'react-gantt'] as const
  const candidates = [
    path.join(process.cwd(), ...segments),
    path.resolve(process.cwd(), '..', '..', ...segments),
  ]
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    } catch {
      /* ignore */
    }
  }
  return candidates[0]
}

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
    const svarDir = resolveSvarReactGanttDir()
    const cssPath = path.join(svarDir, 'dist-full', 'index.css')
    const alias = config.resolve?.alias as Record<string, string | string[] | false> | undefined
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...alias,
      '@svar-ui/react-gantt/all.css': cssPath,
      '@svar-ui/react-gantt': svarDir,
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
