import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@repo/database'
import {
  generateReportData,
  exportToExcel,
} from '@/lib/report-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const member = await prisma.orgMember.findFirst({
    where: { userId: session.user.id, active: true },
    select: { id: true, orgId: true },
  })
  if (!member) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: reportId } = await params
  const format = request.nextUrl.searchParams.get('format') || 'EXCEL'

  const report = await prisma.savedReport.findFirst({
    where: {
      id: reportId,
      orgId: member.orgId,
      OR: [
        { visibility: 'SHARED' },
        { createdByOrgMemberId: member.id },
      ],
    },
  })

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const filters = (report.filtersJson as Record<string, string>) ?? {}
  const columns = (report.columnsJson as string[]) ?? []

  const data = await generateReportData(
    member.orgId,
    report.entityType,
    filters,
    columns
  )

  if (format === 'EXCEL') {
    const buffer = await exportToExcel(data, columns)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${report.name}.xlsx"`,
      },
    })
  }

  if (format === 'CSV') {
    const header = columns.join(',')
    const rows = data.map((row) =>
      columns.map((c) => JSON.stringify(String(row[c] ?? ''))).join(',')
    )
    const csv = [header, ...rows].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${report.name}.csv"`,
      },
    })
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
}
