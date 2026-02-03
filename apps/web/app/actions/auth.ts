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

/** Resolve "Usuario o Email" to email for sign-in (matches Prisma User.email / User.username) */
async function resolveEmailFromLogin(value: string): Promise<string | null> {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.includes('@')) return trimmed
  const user = await prisma.user.findFirst({
    where: { username: trimmed, active: true },
    select: { email: true },
  })
  return user?.email ?? null
}

const CREDENTIALS_ERROR = { _form: ['Usuario o contraseña incorrectos'] as const }

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
    // Validar contra la DB aquí; si falla, no llamar a signIn (evita bugs de Auth.js con server actions)
    const user = await prisma.user.findFirst({
      where: { email, active: true },
      select: { id: true, passwordHash: true },
    })
    if (!user?.passwordHash) {
      return { error: CREDENTIALS_ERROR }
    }
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return { error: CREDENTIALS_ERROR }
    }
    // Credenciales correctas: iniciar sesión vía Auth.js
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error || !result?.ok) {
      return { error: CREDENTIALS_ERROR }
    }
    return redirectTo('/dashboard')
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
