'use server'

import { redirectTo } from '@/lib/i18n-redirect'
import { signIn } from '@/lib/auth'
import { prisma } from '@repo/database'
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

/** Valida credenciales Super Admin y devuelve el email si son correctas. El cliente hace signIn para que la sesión se establezca bien a la primera. */
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
      return { error: CREDENTIALS_ERROR }
    }
    const valid = await bcrypt.compare(trimmedPassword, user.passwordHash)
    if (!valid) {
      return { error: CREDENTIALS_ERROR }
    }
    if (!user.isSuperAdmin) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isSuperAdmin: true },
      })
    }
    // Devolver éxito con email para que el cliente llame a signIn (evita fallo de sesión en primer intento)
    return { ok: true, email: user.email }
  } catch (err) {
    console.error('[auth] superAdminLogin error:', err)
    return { error: CREDENTIALS_ERROR }
  }
}

/** Valida credenciales y devuelve email + isSuperAdmin si son correctas. El cliente hace signIn para que la sesión se establezca bien a la primera. */
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
    // Devolver éxito para que el cliente llame a signIn (evita fallo de sesión en primer intento)
    return { ok: true, email, isSuperAdmin: user.isSuperAdmin === true }
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
  return redirectTo('/dashboard')
}
