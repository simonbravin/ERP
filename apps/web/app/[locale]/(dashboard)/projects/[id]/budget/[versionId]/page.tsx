import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@repo/database'
import { listWbsTemplatesForLibrary } from '@/app/actions/wbs'
import { BudgetVersionStatusDropdown } from '@/components/budget/budget-version-status-dropdown'
import { BudgetVersionTabsWithSearch } from '@/components/budget/budget-version-tabs-with-search'
import { BudgetVersionExport } from '@/components/budget/budget-version-export'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { ProjectTabsWrapper } from '@/components/projects/project-tabs-wrapper'
import { Button } from '@/components/ui/button'
import { Package, Pencil } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { serializeForClient } from '@/lib/utils/serialization'
import type { BudgetTreeNode } from '@/components/budget/budget-tree-table-admin'

type PageProps = {
  params: Promise<{ locale?: string; id: string; versionId: string }>
}

export default async function BudgetVersionPage({ params }: PageProps) {
  const session = await getSession()
  const { id: projectId, versionId, locale } = await params
  if (!session?.user?.id) redirect({ href: '/login', locale: locale ?? 'es' })
  const userId = session!.user!.id

  const org = await getOrgContext(userId)
  if (!org) redirect({ href: '/login', locale: locale ?? 'es' })
  const { orgId, role } = org as NonNullable<typeof org>

  const versionRaw = await prisma.budgetVersion.findFirst({
    where: {
      id: versionId,
      projectId,
      orgId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true,
        },
      },
      budgetLines: {
        include: {
          wbsNode: {
            select: {
              id: true,
              code: true,
              name: true,
              parentId: true,
              category: true,
              sortOrder: true,
              active: true,
            },
          },
          resources: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              resourceType: true,
              quantity: true,
              unitCost: true,
              sortOrder: true,
            },
          },
        },
        orderBy: [{ wbsNode: { sortOrder: 'asc' } }, { wbsNode: { code: 'asc' } }, { sortOrder: 'asc' }],
      },
      createdBy: {
        select: {
          user: { select: { fullName: true, email: true } },
        },
      },
      approvedBy: {
        select: {
          user: { select: { fullName: true, email: true } },
        },
      },
    },
  })

  if (!versionRaw) notFound()

  const wbsTemplates = await listWbsTemplatesForLibrary()

  type VersionWithRelations = typeof versionRaw
  const version = serializeForClient(versionRaw) as unknown as VersionWithRelations

  const wbsNodes = await prisma.wbsNode.findMany({
    where: { projectId, orgId, active: true },
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      category: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })

  // Same criterion for Desglose, Totales, and Planilla Final: only lines whose WBS node is active.
  const wbsGroups = new Map<
    string,
    Array<(typeof version.budgetLines)[number]>
  >()
  for (const line of version.budgetLines) {
    const wbs = line.wbsNode as { active?: boolean }
    if (wbs.active === false) continue
    const wbsId = line.wbsNode.id
    if (!wbsGroups.has(wbsId)) wbsGroups.set(wbsId, [])
    wbsGroups.get(wbsId)!.push(line)
  }

  const globalOverhead = Number(version.globalOverheadPct ?? 0)
  const globalFinancial = Number(version.globalFinancialPct ?? 0)
  const globalProfit = Number(version.globalProfitPct ?? 0)
  const globalTax = Number(version.globalTaxPct ?? 0)

  function buildTreeFromWbs(parentId: string | null): BudgetTreeNode[] {
    const list = wbsNodes as Array<{ id: string; code: string; name: string; parentId: string | null; category: string | null; sortOrder: number }>
    return list
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      .map((n) => ({
        wbsNode: {
          id: n.id,
          code: n.code,
          name: n.name,
          category: (n.category ?? 'ITEM') as 'PHASE' | 'TASK' | 'BUDGET_ITEM' | 'ITEM',
        },
        parentId,
        lines: [] as BudgetTreeNode['lines'],
        children: buildTreeFromWbs(n.id),
      }))
  }

  function lineToTreeLine(line: (typeof version.budgetLines)[number]) {
    return {
      id: line.id,
      description: line.description,
      unit: line.unit,
      quantity: Number(line.quantity),
      directCostTotal: Number(line.directCostTotal),
      actualCostTotal: Number(
        'actualCostTotal' in line && line.actualCostTotal != null
          ? Number(line.actualCostTotal)
          : 0
      ),
      overheadPct: Number(line.overheadPct ?? globalOverhead),
      financialPct: Number(line.financialPct ?? globalFinancial),
      profitPct: Number(line.profitPct ?? globalProfit),
      taxPct: Number(line.taxPct ?? globalTax),
      resources: (line.resources ?? []).map((r: { id: string; resourceType: string; quantity: unknown; unitCost: unknown; sortOrder: number }) => ({
        id: r.id,
        resourceType: r.resourceType,
        quantity: Number(r.quantity),
        unitCost: Number(r.unitCost),
      })),
    }
  }

  function enrichTreeWithLines(
    nodes: BudgetTreeNode[],
    groups: Map<string, Array<(typeof version.budgetLines)[number]>>
  ): BudgetTreeNode[] {
    return nodes.map((node) => {
      const lines = (groups.get(node.wbsNode.id) ?? []).map(lineToTreeLine)
      return {
        ...node,
        lines,
        children: enrichTreeWithLines(node.children, groups),
      }
    })
  }

  // Always show full WBS tree; attach budget lines per node so all phases appear.
  const treeData = enrichTreeWithLines(buildTreeFromWbs(null), wbsGroups)

  const visibleLineIds = new Set<string>()
  wbsGroups.forEach((lines) => {
    lines.forEach((line) => visibleLineIds.add(line.id))
  })

  const visibleLines = version.budgetLines.filter((line) => visibleLineIds.has(line.id))

  const totalDirectCostNum = visibleLines.reduce(
    (sum: number, line: (typeof version.budgetLines)[number]) => sum + Number(line.directCostTotal),
    0
  )

  /** Flatten tree (depth-first) for Planilla Final admin view and sale total. */
  function flattenTreeToSummaryLines(nodes: BudgetTreeNode[]): Array<{ code: string; description: string; unit: string; quantity: number; unitPrice: number; total: number; overheadPct: number; financialPct: number; profitPct: number; taxPct: number }> {
    const out: Array<{ code: string; description: string; unit: string; quantity: number; unitPrice: number; total: number; overheadPct: number; financialPct: number; profitPct: number; taxPct: number }> = []
    for (const node of nodes) {
      for (const line of node.lines) {
        const qty = Number(line.quantity)
        const total = Number(line.directCostTotal)
        out.push({
          code: node.wbsNode.code,
          description: line.description ?? '',
          unit: line.unit ?? '',
          quantity: qty,
          unitPrice: qty ? total / qty : 0,
          total,
          overheadPct: Number(line.overheadPct ?? globalOverhead),
          financialPct: Number(line.financialPct ?? globalFinancial),
          profitPct: Number(line.profitPct ?? globalProfit),
          taxPct: Number(line.taxPct ?? globalTax),
        })
      }
      out.push(...flattenTreeToSummaryLines(node.children))
    }
    return out
  }
  const summaryData = flattenTreeToSummaryLines(treeData)
  /** Total de venta con la misma fórmula que MarkupConfiguration (DESGLOSE DE CÁLCULO): una sola fuente de verdad para Totales, Desglose y Planilla Final. */
  const gg = Number(version.globalOverheadPct)
  const gf = Number(version.globalFinancialPct)
  const util = Number(version.globalProfitPct)
  const tax = Number(version.globalTaxPct)
  const subtotal1 = totalDirectCostNum * (1 + gg / 100)
  const subtotal2 = subtotal1 * (1 + gf / 100 + util / 100)
  const projectTotalSale = subtotal2 * (1 + tax / 100)

  const canEdit =
    ['EDITOR', 'ADMIN', 'OWNER'].includes(role) &&
    (version.status === 'DRAFT' || version.status === 'BASELINE')
  const canChangeStatus = ['ADMIN', 'OWNER'].includes(role)
  const canSeeAdmin = ['ADMIN', 'OWNER'].includes(role)

  const t = await getTranslations('budget')
  const tProjects = await getTranslations('projects')
  const project = version.project as { id: string; name: string; projectNumber: string; status?: string }

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/projects/${projectId}/budget`}>
          ← {t('backToVersions')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {version.project.name}
            </h1>
            {project.status && (
              <ProjectStatusBadge status={project.status} />
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Versión: {version.versionCode} • {version.project.projectNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BudgetVersionStatusDropdown
            versionId={version.id}
            projectId={projectId}
            currentStatus={version.status}
            canEdit={canChangeStatus}
          />
          {(version.status === 'BASELINE' || version.status === 'APPROVED') && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/budget/${version.id}/materials`}>
                <Package className="mr-1.5 h-4 w-4" />
                Ver Materiales
              </Link>
            </Button>
          )}
          <BudgetVersionExport
            versionId={version.id}
            versionCode={version.versionCode}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}/edit`}>
              <Pencil className="mr-1.5 h-4 w-4" />
              {tProjects('edit')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>
          Creado por <strong>{version.createdBy!.user.fullName}</strong>{' '}
          {new Date(version.createdAt as unknown as string).toLocaleDateString('es-AR', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
        {version.approvedBy && version.approvedAt && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">
            Aprobado por <strong>{version.approvedBy!.user.fullName}</strong>{' '}
            {new Date(version.approvedAt as unknown as string).toLocaleDateString('es-AR', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          </span>
        )}
      </div>

      <ProjectTabsWrapper projectId={projectId} />

      <BudgetVersionTabsWithSearch
        treeData={treeData}
        version={{
          id: version.id,
          markupMode: version.markupMode,
          globalOverheadPct: Number(version.globalOverheadPct),
          globalFinancialPct: Number(version.globalFinancialPct),
          globalProfitPct: Number(version.globalProfitPct),
          globalTaxPct: Number(version.globalTaxPct),
        }}
        totalDirectCostNum={totalDirectCostNum}
        summaryData={summaryData}
        projectTotalSale={projectTotalSale}
        canEdit={canEdit}
        canSeeAdmin={canSeeAdmin}
        projectId={projectId}
        wbsTemplates={wbsTemplates}
      />
    </div>
  )
}
