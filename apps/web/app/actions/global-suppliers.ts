'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { getAuthContext } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/permissions'
import { requireRole, type OrgRole } from '@/lib/rbac'
import { publishOutboxEvent } from '@/lib/events/event-publisher'

export async function linkGlobalSupplier(
  globalPartyId: string,
  data: {
    localAlias?: string
    localContactName?: string
    localContactEmail?: string
    localContactPhone?: string
    preferred?: boolean
    paymentTerms?: string
    discountPct?: number
    notes?: string
  }
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const globalParty = await prisma.globalParty.findUnique({
    where: { id: globalPartyId },
  })
  if (!globalParty) throw new Error('Supplier not found')

  const existing = await prisma.orgPartyLink.findUnique({
    where: {
      orgId_globalPartyId: { orgId: org.orgId, globalPartyId },
    },
  })

  if (existing) {
    throw new Error('Already linked to this supplier')
  }

  const link = await prisma.$transaction(async (tx) => {
    const created = await tx.orgPartyLink.create({
      data: {
        orgId: org.orgId,
        globalPartyId,
        localAlias: data.localAlias || undefined,
        localContactName: data.localContactName || undefined,
        localContactEmail: data.localContactEmail || undefined,
        localContactPhone: data.localContactPhone || undefined,
        preferred: data.preferred ?? false,
        status: 'ACTIVE',
        paymentTerms: data.paymentTerms || undefined,
        discountPct: data.discountPct != null ? new Prisma.Decimal(data.discountPct) : undefined,
        notes: data.notes || undefined,
        createdByOrgMemberId: org.memberId,
      },
    })
    await tx.globalParty.update({
      where: { id: globalPartyId },
      data: { orgCount: { increment: 1 } },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PARTY.LINKED',
      entityType: 'OrgPartyLink',
      entityId: created.id,
      payload: { globalPartyId },
    })
    return created
  })

  revalidatePath('/suppliers')
  revalidatePath(`/suppliers/global/${globalPartyId}`)
  return { success: true, linkId: link.id }
}

export async function unlinkGlobalSupplier(globalPartyId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const link = await prisma.orgPartyLink.findUnique({
    where: {
      orgId_globalPartyId: { orgId: org.orgId, globalPartyId },
    },
  })

  if (!link) throw new Error('Not linked to this supplier')

  await prisma.$transaction(async (tx) => {
    await tx.orgPartyLink.update({
      where: { id: link.id },
      data: { status: 'INACTIVE' },
    })
    await tx.globalParty.update({
      where: { id: globalPartyId },
      data: { orgCount: { decrement: 1 } },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PARTY.UNLINKED',
      entityType: 'OrgPartyLink',
      entityId: link.id,
      payload: { globalPartyId },
    })
  })

  revalidatePath('/suppliers')
  revalidatePath(`/suppliers/global/${globalPartyId}`)
  return { success: true }
}

export async function updateSupplierLink(
  linkId: string,
  data: {
    localAlias?: string
    localContactName?: string
    localContactEmail?: string
    localContactPhone?: string
    preferred?: boolean
    paymentTerms?: string
    discountPct?: number
    notes?: string
  }
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const link = await prisma.orgPartyLink.findFirst({
    where: { id: linkId, orgId: org.orgId },
  })
  if (!link) throw new Error('Link not found')

  const updateData: Record<string, unknown> = {}
  if (data.localAlias !== undefined) updateData.localAlias = data.localAlias
  if (data.localContactName !== undefined) updateData.localContactName = data.localContactName
  if (data.localContactEmail !== undefined) updateData.localContactEmail = data.localContactEmail
  if (data.localContactPhone !== undefined) updateData.localContactPhone = data.localContactPhone
  if (data.preferred !== undefined) updateData.preferred = data.preferred
  if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms
  if (data.discountPct !== undefined) updateData.discountPct = new Prisma.Decimal(data.discountPct)
  if (data.notes !== undefined) updateData.notes = data.notes

  await prisma.$transaction(async (tx) => {
    await tx.orgPartyLink.update({
      where: { id: linkId },
      data: updateData,
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PARTY.UPDATED',
      entityType: 'OrgPartyLink',
      entityId: linkId,
      payload: { globalPartyId: link.globalPartyId },
    })
  })

  revalidatePath('/suppliers')
  revalidatePath(`/suppliers/global/${link.globalPartyId}`)
  return { success: true }
}

export async function searchGlobalSuppliers(
  query: string,
  filters?: {
    category?: string
    countries?: string[]
    verified?: boolean
  }
) {
  const { org } = await getAuthContext()

  return prisma.globalParty.findMany({
    where: {
      active: true,
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.verified && { verified: true }),
      ...(filters?.countries?.length && {
        countries: { hasSome: filters.countries },
      }),
    },
    take: 50,
    orderBy: [
      { verified: 'desc' },
      { avgRating: 'desc' },
      { orgCount: 'desc' },
    ],
  })
}

export async function createLocalSupplier(data: {
  name: string
  category?: string
  taxId?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  website?: string
  forceCreate?: boolean
}): Promise<{ success: true; partyId: string } | { success: false; duplicateName: true }> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const nameTrim = data.name.trim()
  if (!data.forceCreate) {
    const existing = await prisma.party.findFirst({
      where: {
        orgId: org.orgId,
        partyType: 'SUPPLIER',
        active: true,
        name: { equals: nameTrim, mode: 'insensitive' },
      },
    })
    if (existing) return { success: false, duplicateName: true }
  }

  const party = await prisma.$transaction(async (tx) => {
    const created = await tx.party.create({
      data: {
        orgId: org.orgId,
        partyType: 'SUPPLIER',
        name: nameTrim,
        category: data.category || undefined,
        taxId: data.taxId || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        website: data.website || undefined,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PARTY.CREATED',
      entityType: 'Party',
      entityId: created.id,
      payload: { partyType: 'SUPPLIER', name: created.name },
    })
    return created
  })

  revalidatePath('/suppliers')
  revalidatePath('/suppliers/list')
  return { success: true, partyId: party.id }
}

export async function createLocalClient(data: {
  name: string
  taxId?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  website?: string
  forceCreate?: boolean
}): Promise<{ success: true; partyId: string } | { success: false; duplicateName: true }> {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const nameTrim = data.name.trim()
  if (!data.forceCreate) {
    const existing = await prisma.party.findFirst({
      where: {
        orgId: org.orgId,
        partyType: 'CLIENT',
        active: true,
        name: { equals: nameTrim, mode: 'insensitive' },
      },
    })
    if (existing) return { success: false, duplicateName: true }
  }

  const party = await prisma.$transaction(async (tx) => {
    const created = await tx.party.create({
      data: {
        orgId: org.orgId,
        partyType: 'CLIENT',
        name: nameTrim,
        taxId: data.taxId || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        website: data.website || undefined,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'PARTY.CREATED',
      entityType: 'Party',
      entityId: created.id,
      payload: { partyType: 'CLIENT', name: created.name },
    })
    return created
  })

  revalidatePath('/suppliers')
  revalidatePath('/suppliers/list')
  return { success: true, partyId: party.id }
}

export type UpdateLocalPartyData = {
  name?: string
  category?: string
  taxId?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  website?: string
}

/** Update any local party (supplier or client) by id. Requires suppliers.edit permission. */
export async function updateLocalParty(partyId: string, data: UpdateLocalPartyData) {
  const { org } = await getAuthContext()
  if (!hasPermission(org.role as OrgRole, 'suppliers', 'edit', org.customPermissions ?? null)) {
    throw new Error('No tienes permiso para editar proveedores y clientes.')
  }

  const party = await prisma.party.findFirst({
    where: { id: partyId, orgId: org.orgId, active: true },
  })
  if (!party) throw new Error('Proveedor o cliente no encontrado')

  await prisma.party.update({
    where: { id: partyId },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.category !== undefined && { category: data.category || null }),
      ...(data.taxId !== undefined && { taxId: data.taxId || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.city !== undefined && { city: data.city || null }),
      ...(data.country !== undefined && { country: data.country || null }),
      ...(data.website !== undefined && { website: data.website || null }),
    },
  })

  revalidatePath('/suppliers')
  revalidatePath('/suppliers/list')
  revalidatePath(`/suppliers/local/${partyId}`)
  revalidatePath(`/suppliers/local/${partyId}/edit`)
  return { success: true }
}

export async function updateLocalSupplier(partyId: string, data: UpdateLocalPartyData) {
  return updateLocalParty(partyId, data)
}

export type PartyDetailWithKpis = {
  party: {
    id: string
    name: string
    partyType: string
    category: string | null
    taxId: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    country: string | null
    website: string | null
  }
  kpis: {
    totalPurchased?: number
    purchaseOrdersCount?: number
    totalSold?: number
    salesCount?: number
  }
}

/** Fetch local party (supplier or client) with KPIs for the detail dialog. */
export async function getPartyDetailWithKpis(partyId: string): Promise<PartyDetailWithKpis | null> {
  const { org } = await getAuthContext()

  const party = await prisma.party.findFirst({
    where: {
      id: partyId,
      orgId: org.orgId,
      partyType: { in: ['SUPPLIER', 'CLIENT'] },
      active: true,
    },
    select: {
      id: true,
      name: true,
      partyType: true,
      taxId: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      website: true,
    },
  })
  if (!party) return null

  const partyWithCategory = party as typeof party & { category?: string | null }
  const kpis: PartyDetailWithKpis['kpis'] = {}

  if (party.partyType === 'SUPPLIER') {
    const poAgg = await prisma.commitment.aggregate({
      where: {
        orgId: org.orgId,
        partyId: party.id,
        commitmentType: 'PO',
        deleted: false,
      },
      _sum: { totalBaseCurrency: true },
      _count: true,
    })
    kpis.totalPurchased = Number(poAgg._sum.totalBaseCurrency ?? 0)
    kpis.purchaseOrdersCount = poAgg._count
  } else {
    const saleAgg = await prisma.financeTransaction.aggregate({
      where: {
        orgId: org.orgId,
        partyId: party.id,
        type: 'SALE',
        deleted: false,
      },
      _sum: { amountBaseCurrency: true },
      _count: true,
    })
    kpis.totalSold = Number(saleAgg._sum.amountBaseCurrency ?? 0)
    kpis.salesCount = saleAgg._count
  }

  return {
    party: {
      id: party.id,
      name: party.name,
      partyType: party.partyType,
      category: partyWithCategory.category ?? null,
      taxId: party.taxId ?? null,
      email: party.email ?? null,
      phone: party.phone ?? null,
      address: party.address ?? null,
      city: party.city ?? null,
      country: party.country ?? null,
      website: party.website ?? null,
    },
    kpis,
  }
}
