'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { uploadToR2, r2Client, StorageNotConfiguredError } from '@/lib/r2-client'
import type { UpdateUserProfileInput, UpdateOrganizationInput } from '@repo/validators'

const IMAGE_MAX_BYTES = 5 * 1024 * 1024 // 5MB
const IMAGE_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

const EXT_TO_MIME: Record<string, (typeof IMAGE_ALLOWED_TYPES)[number]> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

/** Some OS/browsers omit `File.type`; infer from extension when possible. */
function resolveImageContentType(file: File): string | null {
  if (file.type && IMAGE_ALLOWED_TYPES.includes(file.type as (typeof IMAGE_ALLOWED_TYPES)[number])) {
    return file.type
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  const fromExt = ext ? EXT_TO_MIME[ext] : undefined
  return fromExt ?? null
}

export async function updateUserProfile(data: UpdateUserProfileInput) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        fullName: data.fullName,
        username: data.username || null,
      },
    })
    revalidatePath('/settings/profile')
    return { success: true }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { success: false, error: 'Error al actualizar el perfil' }
  }
}

export async function updateOrganization(data: UpdateOrganizationInput) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) throw new Error('Unauthorized')
  requireRole(orgContext.role, 'ADMIN')

  try {
    await prisma.organization.update({
      where: { id: orgContext.orgId },
      data: {
        name: data.name,
        taxId: data.taxId || null,
        country: data.country || null,
        city: data.city || null,
        address: data.address || null,
      },
    })

    const defaultTaxNum =
      typeof data.defaultTaxPct === 'string'
        ? parseFloat(data.defaultTaxPct) || 21
        : (data.defaultTaxPct ?? 21)

    await prisma.orgProfile.upsert({
      where: { orgId: orgContext.orgId },
      create: {
        orgId: orgContext.orgId,
        legalName: data.legalName || data.name,
        taxId: data.taxId || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        phone: data.phone || null,
        email: (data.email === '' || !data.email) ? null : data.email,
        website: (data.website === '' || !data.website) ? null : data.website,
        baseCurrency: data.baseCurrency || 'ARS',
        defaultTaxPct: new Prisma.Decimal(defaultTaxNum),
        documentFooterText: data.documentFooterText || null,
      },
      update: {
        legalName: data.legalName ?? undefined,
        taxId: data.taxId ?? undefined,
        address: data.address ?? undefined,
        city: data.city ?? undefined,
        country: data.country ?? undefined,
        phone: data.phone ?? undefined,
        email: (data.email === '' || !data.email) ? null : data.email,
        website: (data.website === '' || !data.website) ? null : data.website,
        baseCurrency: data.baseCurrency ?? undefined,
        defaultTaxPct: new Prisma.Decimal(defaultTaxNum),
        documentFooterText: data.documentFooterText ?? undefined,
      },
    })

    revalidatePath('/settings/organization')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error updating organization:', error)
    return { success: false, error: 'Error al actualizar la organización' }
  }
}

export async function uploadOrgLogo(formData: FormData) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'Unauthorized' }
  requireRole(orgContext.role, 'ADMIN')

  const file = formData.get('logo') as File | null
  if (!file || !file.size) return { success: false, error: 'Selecciona una imagen' }
  if (file.size > IMAGE_MAX_BYTES) return { success: false, error: 'La imagen no debe superar 5 MB' }
  const contentType = resolveImageContentType(file)
  if (!contentType) {
    return { success: false, error: 'Formato no válido. Usa PNG, JPG, GIF o WebP' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const key = `orgs/${orgContext.orgId}/logo.${ext}`

  try {
    await uploadToR2(file, key, contentType)

    const org = await prisma.organization.findUnique({
      where: { id: orgContext.orgId },
      select: { name: true },
    })

    const existingProfile = await prisma.orgProfile.findUnique({
      where: { orgId: orgContext.orgId },
      select: { id: true },
    })

    if (existingProfile) {
      await prisma.orgProfile.update({
        where: { orgId: orgContext.orgId },
        data: { logoStorageKey: key },
      })
    } else {
      await prisma.currency.upsert({
        where: { code: 'ARS' },
        create: {
          code: 'ARS',
          name: 'Peso argentino',
          symbol: '$',
          decimalPlaces: 2,
          active: true,
        },
        update: {},
      })
      await prisma.orgProfile.create({
        data: {
          orgId: orgContext.orgId,
          legalName: org?.name ?? 'Organization',
          baseCurrency: 'ARS',
          defaultTaxPct: new Prisma.Decimal(21),
          logoStorageKey: key,
        },
      })
    }

    revalidatePath('/settings/organization')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error uploading logo:', error)
    if (error instanceof StorageNotConfiguredError) {
      return { success: false, error: error.message }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return {
        success: false,
        error:
          'No se pudo guardar el logo por un dato relacionado en la base de datos. Revisá monedas (currency) y perfil de organización.',
      }
    }
    return { success: false, error: 'Error al subir el logo' }
  }
}

export async function removeOrgLogo() {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) return { success: false, error: 'Unauthorized' }
  requireRole(orgContext.role, 'ADMIN')

  try {
    const profile = await prisma.orgProfile.findUnique({
      where: { orgId: orgContext.orgId },
      select: { logoStorageKey: true },
    })
    if (!profile?.logoStorageKey) return { success: true }

    await prisma.orgProfile.update({
      where: { orgId: orgContext.orgId },
      data: { logoStorageKey: null },
    })

    revalidatePath('/settings/organization')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error removing logo:', error)
    return { success: false, error: 'Error al quitar el logo' }
  }
}

export async function uploadUserAvatar(formData: FormData) {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const file = formData.get('avatar') as File | null
  if (!file || !file.size) return { success: false, error: 'Selecciona una imagen' }
  if (file.size > IMAGE_MAX_BYTES) return { success: false, error: 'La imagen no debe superar 5 MB' }
  const contentType = resolveImageContentType(file)
  if (!contentType) {
    return { success: false, error: 'Formato no válido. Usa PNG, JPG, GIF o WebP' }
  }

  const userId = session.user.id
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const key = `users/${userId}/avatar.${ext}`

  try {
    await uploadToR2(file, key, contentType)

    const displayUrl = r2Client && process.env.R2_BUCKET_NAME
      ? `r2:${key}`
      : `/uploads/${key}`

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: displayUrl },
    })

    revalidatePath('/settings/profile')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error uploading avatar:', error)
    if (error instanceof StorageNotConfiguredError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Error al subir la foto' }
  }
}

