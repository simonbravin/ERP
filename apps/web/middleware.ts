import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const protectedPaths = [
  '/dashboard',
  '/projects',
  '/finance',
  '/inventory',
  '/resources',
  '/suppliers',
  '/documents',
  '/reports',
  '/settings',
]

function isProtectedPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(es|en)/, '') || '/'
  return protectedPaths.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(p + '/')
  )
}

function getLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(es|en)/)
  return match?.[1] ?? routing.defaultLocale
}

export default auth((req) => {
  const response = intlMiddleware(req)

  if (response.headers.get('x-middleware-rewrite') || response.status === 307 || response.status === 308) {
    return response
  }

  const pathname = req.nextUrl.pathname

  if (isProtectedPath(pathname) && !req.auth) {
    const locale = getLocaleFromPath(pathname)
    const url = new URL(`/${locale}/login`, req.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  return response
})

export const config = {
  matcher: [
    // Exclude api, _next, _vercel, static files (.*.), and /icon (favicon rewrite)
    '/((?!api|_next|_vercel|icon|.*\\..*).*)',
  ],
}
