import createMiddleware from 'next-intl/middleware'
import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
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
  '/team',
]

const superAdminPaths = ['/super-admin']
const superAdminLoginPath = '/super-admin/login'

// Mapeo de prefijo de ruta a módulo (valor de MODULES para canAccess)
const ROUTE_TO_MODULE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/finance': 'finance',
  '/projects': 'projects',
  '/inventory': 'inventory',
  '/resources': 'projects', // recursos bajo proyectos
  '/suppliers': 'projects',
  '/documents': 'documents',
  '/reports': 'reports',
  '/settings': 'settings',
  '/team': 'team',
}

function isProtectedPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(es|en)/, '') || '/'
  return protectedPaths.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(p + '/')
  )
}

function isSuperAdminPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(es|en)/, '') || '/'
  return superAdminPaths.some(
    (p) => withoutLocale === p || withoutLocale.startsWith(p + '/')
  )
}

function isSuperAdminLoginPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(es|en)/, '') || '/'
  return withoutLocale === superAdminLoginPath
}

function getLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(es|en)/)
  return match?.[1] ?? routing.defaultLocale
}

/** Edge-safe: módulos que cada rol puede ver (view). Debe coincidir con ROLE_PERMISSIONS en lib/permissions. */
function canViewModule(role: string, module: string): boolean {
  const viewable: Record<string, string[]> = {
    OWNER: ['dashboard', 'finance', 'projects', 'budget', 'certifications', 'inventory', 'quality', 'documents', 'reports', 'team', 'settings'],
    ADMIN: ['dashboard', 'finance', 'projects', 'budget', 'certifications', 'inventory', 'quality', 'documents', 'reports', 'team', 'settings'],
    EDITOR: ['dashboard', 'finance', 'projects', 'budget', 'certifications', 'inventory', 'quality', 'documents', 'reports', 'team', 'settings'],
    ACCOUNTANT: ['dashboard', 'finance', 'projects', 'budget', 'certifications', 'inventory', 'quality', 'documents', 'reports', 'team'],
    VIEWER: ['dashboard', 'finance', 'projects', 'budget', 'certifications', 'inventory', 'quality', 'documents', 'reports', 'team'],
  }
  const allowed = viewable[role]
  return allowed ? allowed.includes(module) : false
}

function getModuleForPath(pathWithoutLocale: string): string | null {
  for (const [route, module] of Object.entries(ROUTE_TO_MODULE)) {
    if (pathWithoutLocale === route || pathWithoutLocale.startsWith(route + '/')) {
      return module
    }
  }
  return null
}

// Run next-intl first; then protect routes using getToken (Edge-safe). Do not import
// @/lib/auth here—it pulls in bcrypt and Prisma, which break in the Edge runtime.
export default async function middleware(req: NextRequest) {
  const response = intlMiddleware(req)

  if (response.headers.get('x-middleware-rewrite') || response.status === 307 || response.status === 308) {
    return response
  }

  const pathname = req.nextUrl.pathname
  const pathWithoutLocale = pathname.replace(/^\/(es|en)/, '') || '/'

  // Same secret as NextAuth (auth.ts uses NEXTAUTH_SECRET / AUTH_SECRET). Edge must decode the same JWT.
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  try {
    const token = await getToken({
      req,
      secret: secret || undefined,
    })

    if (isSuperAdminLoginPath(pathname)) {
      const locale = getLocaleFromPath(pathname)
      return NextResponse.redirect(new URL(`/${locale}/super-admin`, req.url))
    }
    if (isSuperAdminPath(pathname)) {
      if (!token) {
        return response
      }
      if (!token.isSuperAdmin) {
        const locale = getLocaleFromPath(pathname)
        return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url))
      }
      return response
    }

    // Protected paths (dashboard, etc.): when token is missing in Edge, let the request through.
    // The dashboard layout (Node) will call getSession() and redirect to login if there's no session.
    // This avoids Edge getToken() returning null due to env/secret differences on Vercel while the cookie is valid.
    if (isProtectedPath(pathname)) {
      if (!token) {
        return response
      }
      if (token.isSuperAdmin) {
        const locale = getLocaleFromPath(pathname)
        return NextResponse.redirect(new URL(`/${locale}/super-admin`, req.url))
      }
      const role = token.role as string | undefined
      const module = getModuleForPath(pathWithoutLocale)
      if (role && module && !canViewModule(role, module)) {
        const locale = getLocaleFromPath(pathname)
        return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url))
      }
    }
  } catch {
    // getToken can throw if NEXTAUTH_SECRET missing or invalid
  }

  return response
}

export const config = {
  matcher: [
    // Exclude api, _next, _vercel, static files (.*.), and /icon (favicon rewrite)
    '/((?!api|_next|_vercel|icon|.*\\..*).*)',
  ],
}
