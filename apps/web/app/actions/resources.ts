'use server'

import { revalidatePath } from 'next/cache'
import { prisma, Prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import {
  createResourceSchema,
  updateResourceSchema,
} from '@repo/validators'
import type { CreateResourceInput, UpdateResourceInput } from '@repo/validators'
import { generateResourceCode } from '@/lib/resource-utils'
import { assertBillingWriteAllowed } from '@/lib/billing/guards'

async function getNextResourceSequence(orgId: string, category: string): Promise<number> {
  const prefix = generateResourceCode(category, 0).replace(/0+$/, '')
  const resources = await prisma.resource.findMany({
    where: {
      orgId,
      code: { startsWith: prefix },
      active: true,
    },
    select: { code: true },
    orderBy: { code: 'desc' },
    take: 1,
  })
  const last = resources[0]?.code ?? ''
  const numPart = last.replace(prefix, '') || '0'
  const num = parseInt(numPart, 10)
  return (Number.isNaN(num) ? 0 : num) + 1
}

export type ListResourcesFilters = {
  category?: string
  search?: string
  page?: number
  pageSize?: number
}

export type ListResourcesResult = {
  items: {
    id: string
    code: string
    name: string
    category: string
    unit: string
    unitCost: number
    supplierId: string | null
    active: boolean
    supplier: { name: string } | null
  }[]
  total: number
  page: number
  pageSize: number
}

export async function listResources(
  filters: ListResourcesFilters = {}
): Promise<ListResourcesResult | null> {
  const { org } = await getAuthContext()

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.ResourceWhereInput = {
    orgId: org.orgId,
    active: true,
  }
  if (filters.category) where.category = filters.category
  if (filters.search?.trim()) {
    const q = filters.search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
      skip,
      take: pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        unitCost: true,
        supplierId: true,
        active: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.resource.count({ where }),
  ])

  return {
    items: items.map((r) => ({
      ...r,
      unitCost: Number(r.unitCost),
    })),
    total,
    page,
    pageSize,
  }
}

export async function searchResources(query: string, limit = 20) {
  const { org } = await getAuthContext()
  if (!query?.trim()) return []

  const items = await prisma.resource.findMany({
    where: {
      orgId: org.orgId,
      active: true,
      OR: [
        { name: { contains: query.trim(), mode: 'insensitive' } },
        { code: { contains: query.trim(), mode: 'insensitive' } },
      ],
    },
    orderBy: [{ code: 'asc' }],
    take: limit,
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      unit: true,
      unitCost: true,
    },
  })
  return items.map((r) => ({
    ...r,
    unitCost: Number(r.unitCost),
  }))
}

export async function getResource(id: string) {
  const { org } = await getAuthContext()
  const resource = await prisma.resource.findFirst({
    where: { id, orgId: org.orgId },
    include: { supplier: { select: { id: true, name: true } } },
  })
  if (!resource) return null
  return {
    ...resource,
    unitCost: Number(resource.unitCost),
  }
}

export async function createResource(data: CreateResourceInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const parsed = createResourceSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const code =
    parsed.data.code?.trim() ||
    generateResourceCode(parsed.data.category, await getNextResourceSequence(org.orgId, parsed.data.category))

  const existing = await prisma.resource.findFirst({
    where: { orgId: org.orgId, code },
    select: { id: true },
  })
  if (existing) return { error: { code: ['A resource with this code already exists.'] } }

  if (parsed.data.supplierId) {
    const supplier = await prisma.party.findFirst({
      where: { id: parsed.data.supplierId, orgId: org.orgId },
      select: { id: true },
    })
    if (!supplier) return { error: { supplierId: ['Supplier must belong to your organization.'] } }
  }

  await prisma.resource.create({
    data: {
      orgId: org.orgId,
      code,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description ?? undefined,
      unit: parsed.data.unit,
      unitCost: new Prisma.Decimal(parsed.data.unitCost),
      supplierId: parsed.data.supplierId ?? undefined,
      active: true,
    },
  })

  revalidatePath('/resources')
  return { success: true }
}

export async function updateResource(id: string, data: UpdateResourceInput) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')
  await assertBillingWriteAllowed(org.orgId, 'resources.update')

  const existing = await prisma.resource.findFirst({
    where: { id, orgId: org.orgId },
    select: { id: true },
  })
  if (!existing) return { error: { _form: ['Resource not found'] } }

  const parsed = updateResourceSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  if (parsed.data.code !== undefined) {
    const conflict = await prisma.resource.findFirst({
      where: { orgId: org.orgId, code: parsed.data.code, id: { not: id } },
      select: { id: true },
    })
    if (conflict) return { error: { code: ['A resource with this code already exists.'] } }
  }

  if (parsed.data.supplierId !== undefined && parsed.data.supplierId) {
    const supplier = await prisma.party.findFirst({
      where: { id: parsed.data.supplierId, orgId: org.orgId },
      select: { id: true },
    })
    if (!supplier) return { error: { supplierId: ['Supplier must belong to your organization.'] } }
  }

  const payload: Record<string, unknown> = {}
  if (parsed.data.code !== undefined) payload.code = parsed.data.code
  if (parsed.data.name !== undefined) payload.name = parsed.data.name
  if (parsed.data.category !== undefined) payload.category = parsed.data.category
  if (parsed.data.description !== undefined) payload.description = parsed.data.description
  if (parsed.data.unit !== undefined) payload.unit = parsed.data.unit
  if (parsed.data.unitCost !== undefined) payload.unitCost = new Prisma.Decimal(parsed.data.unitCost)
  if (parsed.data.supplierId !== undefined) payload.supplierId = parsed.data.supplierId ?? null

  await prisma.resource.update({
    where: { id },
    data: payload,
  })

  revalidatePath('/resources')
  revalidatePath(`/resources/${id}/edit`)
  return { success: true }
}

export async function listSuppliers() {
  const { org } = await getAuthContext()
  const parties = await prisma.party.findMany({
    where: { orgId: org.orgId, partyType: 'SUPPLIER', active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return parties
}

export async function deactivateResource(id: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')
  await assertBillingWriteAllowed(org.orgId, 'resources.deactivate')

  const existing = await prisma.resource.findFirst({
    where: { id, orgId: org.orgId },
    select: { id: true },
  })
  if (!existing) throw new Error('Resource not found')

  await prisma.resource.update({
    where: { id },
    data: { active: false },
  })

  revalidatePath('/resources')
  return { success: true }
}
