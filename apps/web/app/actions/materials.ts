'use server'

import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import type { ConsolidatedMaterial, MaterialsBySupplier } from '@/lib/types/materials'
import { RESOURCE_TYPES } from '@/lib/constants/budget'

function getSupplierName(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== 'object') return null
  const v = (attributes as Record<string, unknown>).supplierName
  return typeof v === 'string' ? v : null
}

/**
 * Obtener lista consolidada de materiales de una versión de presupuesto
 */
export async function getConsolidatedMaterials(budgetVersionId: string): Promise<ConsolidatedMaterial[]> {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const { orgId } = await getOrgContext(session.user.id)
  if (!orgId) throw new Error('Unauthorized')

  const version = await prisma.budgetVersion.findFirst({
    where: { id: budgetVersionId, orgId },
    select: { status: true },
  })
  if (!version) throw new Error('Budget version not found')

  const resources = await prisma.budgetResource.findMany({
    where: {
      budgetLine: { budgetVersionId, orgId },
      resourceType: RESOURCE_TYPES.MATERIAL,
    },
    include: {
      budgetLine: {
        select: {
          quantity: true,
          wbsNode: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  const materialsMap = new Map<string, ConsolidatedMaterial>()

  for (const resource of resources) {
    const name = resource.description?.trim() || 'Sin nombre'
    const key = name.toLowerCase().trim()
    const supplierName = getSupplierName(resource.attributes)

    if (!materialsMap.has(key)) {
      materialsMap.set(key, {
        name,
        description: (resource.attributes && typeof resource.attributes === 'object'
          ? (resource.attributes as Record<string, unknown>).description as string | null
          : null) ?? null,
        unit: resource.unit,
        totalQuantity: 0,
        averageUnitCost: 0,
        totalCost: 0,
        suppliers: [],
        usedInItems: [],
      })
    }

    const material = materialsMap.get(key)!
    const lineQty = Number(resource.budgetLine.quantity) || 1
    const quantityNeeded = Number(resource.quantity) * lineQty
    const costForThisItem = quantityNeeded * Number(resource.unitCost)

    material.totalQuantity += quantityNeeded
    material.totalCost += costForThisItem

    if (supplierName) {
      const existing = material.suppliers.find((s) => s.name === supplierName)
      if (existing) {
        existing.quantity += quantityNeeded
      } else {
        material.suppliers.push({
          name: supplierName,
          quantity: quantityNeeded,
          unitCost: Number(resource.unitCost),
        })
      }
    }

    material.usedInItems.push({
      wbsCode: resource.budgetLine.wbsNode.code,
      wbsName: resource.budgetLine.wbsNode.name,
      quantity: quantityNeeded,
    })
  }

  const consolidated: ConsolidatedMaterial[] = []
  for (const material of materialsMap.values()) {
    if (material.totalQuantity > 0) {
      material.averageUnitCost = material.totalCost / material.totalQuantity
    }
    consolidated.push(material)
  }
  return consolidated
}

/**
 * Agrupar materiales por proveedor (solo recursos con supplierName en attributes)
 */
export async function getMaterialsBySupplier(budgetVersionId: string): Promise<MaterialsBySupplier[]> {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const { orgId } = await getOrgContext(session.user.id)
  if (!orgId) throw new Error('Unauthorized')

  const resources = await prisma.budgetResource.findMany({
    where: {
      budgetLine: { budgetVersionId, orgId },
      resourceType: RESOURCE_TYPES.MATERIAL,
    },
    include: {
      budgetLine: { select: { quantity: true } },
    },
  })

  const suppliersMap = new Map<string, MaterialsBySupplier>()

  for (const resource of resources) {
    const supplierName = getSupplierName(resource.attributes)
    if (!supplierName) continue

    if (!suppliersMap.has(supplierName)) {
      suppliersMap.set(supplierName, {
        supplierName,
        totalCost: 0,
        materials: [],
      })
    }

    const supplier = suppliersMap.get(supplierName)!
    const lineQty = Number(resource.budgetLine.quantity) || 1
    const quantityNeeded = Number(resource.quantity) * lineQty
    const totalCost = quantityNeeded * Number(resource.unitCost)
    const name = resource.description?.trim() || 'Sin nombre'

    supplier.totalCost += totalCost
    const existing = supplier.materials.find((m) => m.name === name)
    if (existing) {
      existing.quantity += quantityNeeded
      existing.totalCost += totalCost
    } else {
      supplier.materials.push({
        name,
        unit: resource.unit,
        quantity: quantityNeeded,
        unitCost: Number(resource.unitCost),
        totalCost,
      })
    }
  }

  return Array.from(suppliersMap.values()).sort((a, b) => b.totalCost - a.totalCost)
}

/**
 * Generar pre-orden de compra para un proveedor (retorna datos para documento)
 */
export async function generatePurchaseOrder(
  budgetVersionId: string,
  supplierName: string
): Promise<
  | { success: true; data: { project: { name: string; projectNumber: string; clientName: string | null }; versionCode: string; supplier: MaterialsBySupplier; generatedAt: Date } }
  | { success: false; error: string }
> {
  const session = await getSession()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const { orgId } = await getOrgContext(session.user.id)
  if (!orgId) return { success: false, error: 'Unauthorized' }

  try {
    const version = await prisma.budgetVersion.findFirst({
      where: { id: budgetVersionId, orgId },
      include: {
        project: { select: { name: true, projectNumber: true, clientName: true } },
      },
    })
    if (!version) return { success: false, error: 'Budget version not found' }

    const bySupplier = await getMaterialsBySupplier(budgetVersionId)
    const supplier = bySupplier.find((s) => s.supplierName === supplierName)
    if (!supplier) return { success: false, error: 'Supplier not found' }

    return {
      success: true,
      data: {
        project: version.project,
        versionCode: version.versionCode,
        supplier,
        generatedAt: new Date(),
      },
    }
  } catch (error) {
    console.error('Error generating purchase order:', error)
    return { success: false, error: 'Error al generar orden de compra' }
  }
}
