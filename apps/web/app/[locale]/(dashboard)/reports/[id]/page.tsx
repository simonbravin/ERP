import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { ReportPreview } from '@/components/reports/report-preview'
import { generateReportData } from '@/lib/report-generator'

const ENTITY_COLUMNS: Record<string, { key: string; label: string }[]> = {
  PROJECT: [
    { key: 'projectNumber', label: 'Number' },
    { key: 'name', label: 'Name' },
    { key: 'clientName', label: 'Client' },
    { key: 'status', label: 'Status' },
    { key: 'phase', label: 'Phase' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'plannedEndDate', label: 'Planned End' },
    { key: 'totalBudget', label: 'Total Budget' },
    { key: 'location', label: 'Location' },
  ],
  FINANCE_TRANSACTION: [
    { key: 'transactionNumber', label: 'Transaction #' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'issueDate', label: 'Issue Date' },
    { key: 'description', label: 'Description' },
    { key: 'total', label: 'Total' },
    { key: 'currency', label: 'Currency' },
    { key: 'projectName', label: 'Project' },
  ],
  BUDGET_LINE: [
    { key: 'wbsCode', label: 'WBS Code' },
    { key: 'wbsName', label: 'WBS Name' },
    { key: 'description', label: 'Description' },
    { key: 'unit', label: 'Unit' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'directCostTotal', label: 'Direct Cost' },
    { key: 'salePriceTotal', label: 'Sale Price' },
    { key: 'projectName', label: 'Project' },
  ],
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ReportDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id } = await params

  const report = await prisma.savedReport.findFirst({
    where: {
      id,
      orgId: org.orgId,
      OR: [
        { visibility: 'SHARED' },
        { createdByOrgMemberId: org.memberId },
      ],
    },
    include: {
      createdBy: { select: { user: { select: { fullName: true } } } },
    },
  })

  if (!report) notFound()

  const filters = (report.filtersJson as Record<string, string>) ?? {}
  const columns = (report.columnsJson as string[]) ?? []
  const data = await generateReportData(
    org.orgId,
    report.entityType,
    filters,
    columns
  )

  const columnDefs = (ENTITY_COLUMNS[report.entityType] ?? []).filter((c) =>
    columns.includes(c.key)
  )

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/reports"
            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← Reports
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {report.name}
          </h1>
          {report.description && (
            <p className="mt-1 text-sm text-gray-500">{report.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            by {report.createdBy?.user?.fullName} • {report.visibility}
          </p>
        </div>
        <Link
          href={`/reports/${id}/run`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Run / Export
        </Link>
      </div>

      <ReportPreview data={data} columns={columnDefs} />
    </div>
  )
}
