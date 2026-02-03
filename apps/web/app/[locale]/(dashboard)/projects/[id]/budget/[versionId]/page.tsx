import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { Package } from 'lucide-react'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import {
  getBudgetVersion,
  listBudgetLines,
  getVersionTotal,
  listBudgetVersions,
  getOrgDefaultIndirectPct,
} from '@/app/actions/budget'
import { listProjectWBS } from '@/app/actions/wbs'
import { BudgetVersionTabs } from '@/components/budget/budget-version-tabs'

type PageProps = {
  params: Promise<{ id: string; versionId: string }>
}

export default async function BudgetVersionLinesPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId, versionId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const [version, lines, versionTotal, versions, wbsTree, defaultIndirectPct] = await Promise.all([
    getBudgetVersion(versionId),
    listBudgetLines(versionId),
    getVersionTotal(versionId),
    listBudgetVersions(projectId),
    listProjectWBS(projectId),
    getOrgDefaultIndirectPct(),
  ])

  if (!version || version.projectId !== projectId) notFound()

  const canEdit = hasMinimumRole(org.role, 'EDITOR')
  const canViewAdmin = org.role === 'ADMIN' || org.role === 'OWNER'

  function flattenWbs(
    nodes: { id: string; code: string; name: string; children: unknown[] }[],
    out: { id: string; code: string; name: string }[] = []
  ): { id: string; code: string; name: string }[] {
    for (const n of nodes) {
      out.push({ id: n.id, code: n.code, name: n.name })
      flattenWbs((n.children as { id: string; code: string; name: string; children: unknown[] }[]) ?? [], out)
    }
    return out
  }

  const wbsOptions = wbsTree ? flattenWbs(wbsTree as { id: string; code: string; name: string; children: unknown[] }[]) : []
  const otherVersions = (versions ?? []).filter((v) => v.id !== versionId)

  // Serialize for client (Prisma Decimal/Date are not serializable)
  function serializeLine(line: (typeof lines)[number]) {
    return {
      id: line.id,
      description: line.description,
      unit: line.unit,
      quantity: Number(line.quantity),
      directCostTotal: Number(line.directCostTotal),
      salePriceTotal: line.salePriceTotal != null ? Number(line.salePriceTotal) : undefined,
      overheadPct: Number(line.overheadPct ?? 0),
      financialPct: Number(line.financialPct ?? 0),
      profitPct: Number(line.profitPct ?? 0),
      taxPct: Number(line.taxPct ?? 0),
      wbsNode: { id: line.wbsNode.id, code: line.wbsNode.code, name: line.wbsNode.name },
      resources: ('resources' in line ? (line as { resources: Array<{ id: string; resourceType: string; description: string; unit: string; quantity: unknown; unitCost: unknown; totalCost: unknown; attributes: unknown }> }).resources : []).map((r) => ({
        id: r.id,
        resourceType: r.resourceType,
        description: r.description,
        unit: r.unit,
        quantity: Number(r.quantity),
        unitCost: Number(r.unitCost),
        totalCost: Number(r.totalCost),
        attributes: r.attributes,
      })),
    }
  }
  const serializedLines = (lines ?? []).map(serializeLine)

  function serializeWbsNode(node: { id: string; code: string; name: string; category: string; parentId: string | null; unit: string | null; quantity: unknown; children: unknown[] }): { id: string; code: string; name: string; category: string; parentId: string | null; unit: string | null; quantity: number; children: ReturnType<typeof serializeWbsNode>[] } {
    return {
      id: node.id,
      code: node.code,
      name: node.name,
      category: node.category,
      parentId: node.parentId,
      unit: node.unit,
      quantity: typeof node.quantity === 'number' ? node.quantity : Number(node.quantity ?? 0),
      children: (node.children ?? []).map((c) => serializeWbsNode(c as typeof node)),
    }
  }
  const serializedWbsTree = (wbsTree ?? []).map((n) => serializeWbsNode(n as { id: string; code: string; name: string; category: string; parentId: string | null; unit: string | null; quantity: unknown; children: unknown[] }))

  // Build tree data for BudgetVersionView: { wbsNode, lines, children } per node
  type WbsNodeSerialized = { id: string; code: string; name: string; category: string; parentId: string | null; unit: string | null; quantity: number; children: WbsNodeSerialized[] }
  type LineSerialized = ReturnType<typeof serializeLine>
  const linesByWbsId = new Map<string, LineSerialized[]>()
  for (const line of serializedLines) {
    const id = line.wbsNode.id
    if (!linesByWbsId.has(id)) linesByWbsId.set(id, [])
    linesByWbsId.get(id)!.push(line)
  }
  function buildTreeData(nodes: WbsNodeSerialized[]): import('@/components/budget/budget-tree-table-admin').BudgetTreeNode[] {
    return nodes.map((node) => {
      const nodeLines = linesByWbsId.get(node.id) ?? []
      const treeLines = nodeLines.map((l) => ({
        id: l.id,
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        directCostTotal: l.directCostTotal,
        overheadPct: l.overheadPct,
        financialPct: l.financialPct,
        profitPct: l.profitPct,
        taxPct: l.taxPct,
        resources: (l.resources ?? []).map((r) => ({
          id: r.id,
          resourceType: r.resourceType,
          quantity: r.quantity,
          unitCost: r.unitCost,
        })),
      }))
      return {
        wbsNode: { id: node.id, code: node.code, name: node.name, category: node.category },
        lines: treeLines,
        children: buildTreeData(node.children ?? []),
      }
    })
  }
  const treeData = buildTreeData(serializedWbsTree as WbsNodeSerialized[])

  const computeSheetLines = (lines ?? [])
    .map((line) => {
      const qty = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity)
      const total =
        line.salePriceTotal != null
          ? typeof line.salePriceTotal === 'number'
            ? line.salePriceTotal
            : Number(line.salePriceTotal)
          : typeof line.directCostTotal === 'number'
            ? line.directCostTotal
            : Number(line.directCostTotal)
      const unitPrice = qty > 0 ? total / qty : 0
      return {
        id: line.id,
        wbsCode: line.wbsNode.code,
        wbsName: line.wbsNode.name,
        unit: line.unit,
        quantity: qty,
        unitPrice,
        total,
        hasAPU: true,
      }
    })
    .sort((a, b) => a.wbsCode.localeCompare(b.wbsCode))

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/projects/${projectId}/budget`}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Budget
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {version.versionCode} — {version.versionType} ({version.status})
        </h2>
        <div className="flex items-center gap-3">
          {(version.status === 'BASELINE' || version.status === 'APPROVED') && (
            <Link
              href={`/projects/${projectId}/budget/${versionId}/materials`}
              className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <Package className="mr-1.5 h-4 w-4" />
              Ver Materiales
            </Link>
          )}
          <Link
            href={`/projects/${projectId}/budget/${versionId}/compute`}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Planilla de cómputo →
          </Link>
        </div>
      </div>
      <BudgetVersionTabs
        projectId={projectId}
        versionId={versionId}
        version={version}
        lines={serializedLines}
        wbsTree={serializedWbsTree}
        treeData={treeData}
        computeSheetLines={computeSheetLines}
        versionTotal={versionTotal}
        wbsOptions={wbsOptions}
        otherVersions={otherVersions.map((v) => ({ id: v.id, versionCode: v.versionCode }))}
        canEdit={canEdit}
        canViewAdmin={canViewAdmin}
        userRole={org.role}
        defaultIndirectPct={defaultIndirectPct}
      />
    </div>
  )
}
