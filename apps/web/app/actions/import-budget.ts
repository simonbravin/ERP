'use server'

import { redirectToLogin } from '@/lib/i18n-redirect'
import { revalidatePath } from 'next/cache'
import { prisma } from '@repo/database'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { requireRole } from '@/lib/rbac'
import { Prisma } from '@repo/database'
import type { ParsedWbsItem } from '@/lib/types/excel-import'

async function getAuthContext() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()
  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()
  return { session, org }
}

async function generateProjectNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PROJ-${year}-`
  const rows = await prisma.project.findMany({
    where: { orgId, projectNumber: { startsWith: prefix } },
    select: { projectNumber: true },
    orderBy: { projectNumber: 'desc' },
    take: 1,
  })
  const nextSeq = rows[0] ? parseInt(rows[0].projectNumber.replace(prefix, ''), 10) + 1 : 1
  return `${prefix}${String(nextSeq).padStart(3, '0')}`
}

export type ImportBudgetInput = {
  projectName: string
  clientName?: string
  location?: string
  items: ParsedWbsItem[]
}

export type ImportBudgetResult = {
  success: boolean
  projectId?: string
  budgetVersionId?: string
  itemsCreated?: number
  budgetLinesCreated?: number
  error?: string
}

export async function importBudgetFromExcel(
  data: ImportBudgetInput
): Promise<ImportBudgetResult> {
  const { session, org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  try {
    const projectNumber = await generateProjectNumber(org.orgId)

    const project = await prisma.project.create({
      data: {
        orgId: org.orgId,
        projectNumber,
        name: data.projectName,
        clientName: data.clientName ?? null,
        location: data.location ?? null,
        phase: 'PRE_CONSTRUCTION',
        status: 'DRAFT',
        createdByOrgMemberId: org.memberId,
      },
    })

    const codeToNodeId = new Map<string, string>()
    let wbsNodesCreated = 0

    async function createWbsNode(
      item: ParsedWbsItem,
      parentId: string | null = null
    ) {
      const category = item.isLeaf
        ? 'BUDGET_ITEM'
        : item.level === 0
          ? 'PHASE'
          : 'TASK'

      const node = await prisma.wbsNode.create({
        data: {
          orgId: org.orgId,
          projectId: project.id,
          parentId,
          code: item.code,
          name: item.name,
          category,
          unit: item.unit ?? 'un',
          quantity: new Prisma.Decimal(item.quantity),
          active: true,
        },
      })

      codeToNodeId.set(item.code, node.id)
      wbsNodesCreated++

      for (const child of item.children) {
        await createWbsNode(child, node.id)
      }
    }

    for (const rootItem of data.items) {
      await createWbsNode(rootItem)
    }

    const budgetVersion = await prisma.budgetVersion.create({
      data: {
        orgId: org.orgId,
        projectId: project.id,
        versionCode: 'V1',
        versionType: 'INITIAL',
        status: 'DRAFT',
        notes: 'Versión importada desde Excel',
        createdByOrgMemberId: org.memberId,
      },
    })

    let budgetLinesCreated = 0
    let sortOrder = 0

    function* walkItems(items: ParsedWbsItem[]): Generator<ParsedWbsItem> {
      for (const item of items) {
        yield item
        yield* walkItems(item.children)
      }
    }

    for (const item of walkItems(data.items)) {
      if (!item.isLeaf) continue
      const nodeId = codeToNodeId.get(item.code)
      if (!nodeId) continue

      const amount = new Prisma.Decimal(item.amount)
      await prisma.budgetLine.create({
        data: {
          orgId: org.orgId,
          budgetVersionId: budgetVersion.id,
          wbsNodeId: nodeId,
          description: item.name,
          unit: item.unit ?? 'un',
          quantity: new Prisma.Decimal(item.quantity),
          directCostTotal: amount,
          salePriceTotal: amount,
          overheadPct: new Prisma.Decimal(0),
          indirectCostPct: new Prisma.Decimal(0),
          financialPct: new Prisma.Decimal(0),
          profitPct: new Prisma.Decimal(0),
          taxPct: new Prisma.Decimal(21),
          retentionPct: new Prisma.Decimal(0),
          sortOrder: sortOrder++,
        },
      })
      budgetLinesCreated++
    }

    revalidatePath('/projects')
    revalidatePath(`/projects/${project.id}`)

    return {
      success: true,
      projectId: project.id,
      budgetVersionId: budgetVersion.id,
      itemsCreated: wbsNodesCreated,
      budgetLinesCreated,
    }
  } catch (error) {
    console.error('Error importing budget:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al importar presupuesto',
    }
  }
}
