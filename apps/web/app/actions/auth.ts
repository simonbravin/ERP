'use server'

import { redirectTo } from '@/lib/i18n-redirect'
import { signIn } from '@/lib/auth'
import { prisma } from '@repo/database'
import { getTranslations } from 'next-intl/server'
import {
  loginFormSchema,
  registerSchema,
} from '@repo/validators'
import type { LoginFormInput, RegisterInput } from '@repo/validators'
import bcrypt from 'bcryptjs'

function generateSlug(orgName: string): string {
  return orgName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

async function findUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug || 'org'
  let suffix = 0
  while (true) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
    })
    if (!existing) return slug
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }
}

const SUPER_ADMIN_USERNAME = 'superadmin'
const SUPER_ADMIN_PLACEHOLDER_EMAIL = 'superadmin@system.internal'

/** Resolve "Usuario o Email" to email for sign-in (matches Prisma User.email / User.username) */
async function resolveEmailFromLogin(value: string): Promise<string | null> {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.includes('@')) return trimmed
  // Por username (coincidencia exacta)
  let user = await prisma.user.findFirst({
    where: { username: trimmed, active: true },
    select: { email: true },
  })
  if (user?.email) return user.email
  // Fallback: si escribió "superadmin", buscar por email interno (por si el usuario en DB no tiene username aún)
  if (trimmed.toLowerCase() === SUPER_ADMIN_USERNAME) {
    user = await prisma.user.findFirst({
      where: {
        email: SUPER_ADMIN_PLACEHOLDER_EMAIL,
        active: true,
      },
      select: { email: true },
    })
    if (user?.email) return user.email
  }
  return null
}

const CREDENTIALS_ERROR = { _form: ['Usuario o contraseña incorrectos'] as const }

/** Valida credenciales Super Admin y establece sesión en el mismo request (evita fallos del primer intento por signIn desde el cliente). */
export async function superAdminLogin(username: string, password: string) {
  const trimmedUser = username?.trim()
  const trimmedPassword = password?.trim()
  if (!trimmedUser) {
    return { error: { _form: ['Ingresá el usuario'] as const } }
  }
  if (!trimmedPassword) {
    return { error: { _form: ['Ingresá la contraseña'] as const } }
  }
  if (trimmedUser.toLowerCase() !== SUPER_ADMIN_USERNAME) {
    return { error: CREDENTIALS_ERROR }
  }
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: SUPER_ADMIN_USERNAME, active: true },
          { email: SUPER_ADMIN_PLACEHOLDER_EMAIL, active: true },
        ],
      },
      select: { id: true, email: true, passwordHash: true, isSuperAdmin: true },
    })
    if (!user?.passwordHash) {
      console.warn('[auth] superAdminLogin: no user or no passwordHash')
      return { error: CREDENTIALS_ERROR }
    }
    const valid = await bcrypt.compare(trimmedPassword, user.passwordHash)
    if (!valid) {
      console.warn('[auth] superAdminLogin: invalid password')
      return { error: CREDENTIALS_ERROR }
    }
    if (!user.isSuperAdmin) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isSuperAdmin: true },
      })
    }
    const signInResult = await signIn('credentials', {
      email: user.email,
      password: trimmedPassword,
      redirect: false,
    })
    if (
      signInResult &&
      typeof signInResult === 'object' &&
      'ok' in signInResult &&
      signInResult.ok === false
    ) {
      console.warn('[auth] superAdminLogin: signIn failed after validation', signInResult)
      return { error: { _form: ['No se pudo iniciar sesión. Reintentá.'] as const } }
    }
    return { ok: true as const }
  } catch (err) {
    console.error('[auth] superAdminLogin error:', err)
    return { error: CREDENTIALS_ERROR }
  }
}

/** Valida credenciales y establece sesión en el mismo request (evita cold start / CSRF en un segundo POST a /api/auth desde el cliente). */
export async function login(credentials: LoginFormInput) {
  const parsed = loginFormSchema.safeParse(credentials)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  const { emailOrUsername, password } = parsed.data
  try {
    const email = await resolveEmailFromLogin(emailOrUsername)
    if (!email) {
      return { error: CREDENTIALS_ERROR }
    }
    const user = await prisma.user.findFirst({
      where: { email, active: true },
      select: { id: true, passwordHash: true, isSuperAdmin: true },
    })
    if (!user?.passwordHash) {
      return { error: CREDENTIALS_ERROR }
    }
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return { error: CREDENTIALS_ERROR }
    }
    const signInResult = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    if (
      signInResult &&
      typeof signInResult === 'object' &&
      'ok' in signInResult &&
      signInResult.ok === false
    ) {
      const err = (signInResult as { error?: string }).error
      console.warn('[auth] login: signIn failed after credential check', { err, signInResult })
      if (err === 'AccessDenied' || err === 'Callback') {
        const t = await getTranslations('auth')
        return {
          error: {
            _form: [t('noOrganization')],
          },
        }
      }
      return { error: CREDENTIALS_ERROR }
    }
    return { ok: true as const, isSuperAdmin: user.isSuperAdmin === true }
  } catch (err) {
    console.error('[auth] login error:', err)
    return { error: CREDENTIALS_ERROR }
  }
}

export async function register(data: RegisterInput) {
  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  const { email, password, fullName, orgName, username, country, city, phone } =
    parsed.data
  try {
    const existingByEmail = await prisma.user.findUnique({ where: { email } })
    if (existingByEmail) {
      return { error: { email: ['Ya existe una cuenta con este email'] } }
    }
    const existingByUsername = await prisma.user.findUnique({
      where: { username: username.trim() },
    })
    if (existingByUsername) {
      return { error: { username: ['Este nombre de usuario ya está en uso'] } }
    }
    const baseSlug = generateSlug(orgName)
    const slug = await findUniqueSlug(baseSlug)
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.$transaction(async (tx) => {
    await tx.currency.upsert({
      where: { code: 'ARS' },
      create: {
        code: 'ARS',
        name: 'Argentine Peso',
        symbol: '$',
        decimalPlaces: 2,
        active: true,
      },
      update: {},
    })
    await tx.currency.upsert({
      where: { code: 'USD' },
      create: {
        code: 'USD',
        name: 'US Dollar',
        symbol: 'US$',
        decimalPlaces: 2,
        active: true,
      },
      update: {},
    })
    const user = await tx.user.create({
      data: {
        email,
        username: username.trim(),
        fullName,
        passwordHash,
        active: true,
      },
    })
    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        active: true,
      },
    })
    await tx.orgProfile.create({
      data: {
        orgId: org.id,
        legalName: orgName,
        baseCurrency: 'ARS',
        defaultTaxPct: 21,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone?.trim() || undefined,
      },
    })
    // Primer usuario de la empresa siempre es OWNER (crítico para RBAC)
    await tx.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: 'OWNER',
        active: true,
      },
    })
    })
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
  } catch (err) {
    console.error('[auth] register error:', err)
    return {
      error: {
        _form: [
          'Error al crear la cuenta. Revisá los datos o intentá más tarde.',
        ],
      },
    }
  }
  return redirectTo('/dashboard')
}
