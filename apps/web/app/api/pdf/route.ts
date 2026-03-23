import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/** PDF generation can be slow (Chromium); allow up to 60s on Vercel Pro. */
export const maxDuration = 60
export const dynamic = 'force-dynamic'
import { prisma } from '@repo/database'
import { getOrgContext } from '@/lib/org-context'
import { getBudgetExportData } from '@/app/actions/budget'
import { getProject } from '@/app/actions/projects'
import { getDownloadUrl } from '@/lib/r2-client'
import { buildBudgetPrintHtml } from '@/lib/pdf/build-budget-print-html'
import { buildPurchaseOrderPrintHtml } from '@/lib/pdf/build-purchase-order-print-html'
import { buildSchedulePrintHtml } from '@/lib/pdf/build-schedule-print-html'
import { buildScheduleVisualPrintHtml } from '@/lib/pdf/build-schedule-visual-print-html'
import { renderUrlToPdf, renderHtmlToPdf } from '@/lib/pdf/render-pdf'
import { getDocumentTemplate } from '@/lib/pdf/templates'

function escapePdfHeader(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getBaseUrl(request: NextRequest): string {
  // Use request origin so the headless browser hits the same host/port (e.g. localhost:3333)
  const origin = request.nextUrl.origin
  if (origin) return origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  return 'http://localhost:3333'
}

function getCookiesFromRequest(request: NextRequest): { name: string; value: string }[] {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return []
  return cookieHeader.split(';').map((part) => {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq < 0) return { name: '', value: '' }
    return { name: trimmed.slice(0, eq), value: trimmed.slice(eq + 1) }
  }).filter((c) => c.name.length > 0)
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let orgId = (session.user as { orgId?: string }).orgId
  if (!orgId) {
    const member = await prisma.orgMember.findFirst({
      where: { userId: session.user.id, active: true },
      select: { orgId: true },
    })
    orgId = member?.orgId ?? undefined
  }
  if (!orgId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const templateParam = request.nextUrl.searchParams.get('template')
  const docParam = request.nextUrl.searchParams.get('doc')
  const templateId = templateParam ?? docParam
  const id = request.nextUrl.searchParams.get('id')
  const locale = request.nextUrl.searchParams.get('locale') || 'es'
  const showEmitidoParam = request.nextUrl.searchParams.get('showEmitidoPor')
  const showFullCompanyParam = request.nextUrl.searchParams.get('showFullCompanyData')
  const columnsParam = request.nextUrl.searchParams.get('columns')

  if (!templateId) {
    return NextResponse.json(
      { error: 'Parámetros inválidos: template (o doc) es requerido' },
      { status: 400 }
    )
  }

  let template
  try {
    template = getDocumentTemplate(templateId)
  } catch {
    return NextResponse.json(
      { error: `Plantilla desconocida: ${templateId}` },
      { status: 400 }
    )
  }

  if (template.id === 'computo' && !id) {
    return NextResponse.json(
      { error: 'Parámetros inválidos: doc e id son requeridos' },
      { status: 400 }
    )
  }

  const accessSession = { userId: session.user.id, orgId }

  try {
    await template.validateAccess({ session: accessSession, id: id ?? undefined })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sin acceso'
    const isNotFound = message.toLowerCase().includes('no encontrada') || message.toLowerCase().includes('no encontrado')
    return NextResponse.json(
      { error: message },
      { status: isNotFound ? 404 : 403 }
    )
  }

  const baseUrl = getBaseUrl(request)
  const reserved = new Set(['template', 'doc', 'id', 'locale'])
  const query: Record<string, string> = {}
  request.nextUrl.searchParams.forEach((value, key) => {
    if (!reserved.has(key)) query[key] = value
  })
  const printUrl = template.buildPrintUrl({
    baseUrl,
    locale,
    id: id ?? undefined,
    query: Object.keys(query).length ? query : undefined,
  })
  const cookies = getCookiesFromRequest(request)
  const rawCookieHeader = request.headers.get('cookie')
  const pdfOptions: { format: 'A4'; printBackground: boolean; landscape?: boolean } = {
    format: 'A4',
    printBackground: true,
  }
  /** Cronograma: tabla ancha → A4 apaisado (mismo pie/numeración que otros PDF HTML en `render-pdf.ts`). */
  if (template.id === 'schedule') {
    pdfOptions.landscape = true
  }

  try {
    let pdfBuffer: Buffer

    if (template.id === 'budget' && id) {
      // Same dataset as Planilla Final: full WBS tree flattened (one row per node) via getBudgetExportData.
      const org = await getOrgContext(session.user.id)
      if (!org) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      let orgProfile: { legalName: string | null; taxId: string | null; country: string | null; address: string | null; email: string | null; phone: string | null } | null = null
      let logoUrl: string | null = null
      try {
        const profile = await prisma.orgProfile.findUnique({
          where: { orgId: org.orgId },
          select: { legalName: true, taxId: true, country: true, address: true, email: true, phone: true, logoStorageKey: true },
        })
        if (profile) {
          orgProfile = {
            legalName: profile.legalName ?? null,
            taxId: profile.taxId ?? null,
            country: profile.country ?? null,
            address: profile.address ?? null,
            email: profile.email ?? null,
            phone: profile.phone ?? null,
          }
          if (profile.logoStorageKey) {
            const url = await getDownloadUrl(profile.logoStorageKey)
            if (url.startsWith('http') || url.startsWith('/')) logoUrl = url
          }
        }
      } catch {
        // optional
      }
      const data = await getBudgetExportData(id)
      if (!data) {
        return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
      }
      const { version, rows, grandTotal } = data
      if (process.env.NODE_ENV === 'development') {
        console.log('[PDF budget] rows count (WBS nodes):', rows.length)
      }
      const project = await getProject(version.projectId)
      if (!project) {
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      }
      const userName = session.user.name ?? session.user.email ?? ''
      const formatDate = (d: Date | string | null | undefined) =>
        d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
      const endDate = (project as { plannedEndDate?: Date | null; baselinePlannedEndDate?: Date | null; actualEndDate?: Date | null }).plannedEndDate
        ?? (project as { baselinePlannedEndDate?: Date | null }).baselinePlannedEndDate
        ?? (project as { actualEndDate?: Date | null }).actualEndDate
      const projectInfo = {
        projectName: project.name,
        projectNumber: project.projectNumber ?? null,
        clientName: (project as { clientName?: string | null }).clientName ?? null,
        location: (project as { location?: string | null }).location ?? null,
        startDate: formatDate((project as { startDate?: Date | null }).startDate),
        endDate: formatDate(endDate),
        surfaceM2: (project as { m2?: unknown }).m2 != null ? String(Number((project as { m2: unknown }).m2)) : null,
        description: (project as { description?: string | null }).description ?? null,
      }
      const layout = {
        orgName: org.orgName ?? 'Organización',
        orgLegalName: orgProfile?.legalName ?? null,
        logoUrl,
        taxId: orgProfile?.taxId ?? null,
        country: orgProfile?.country ?? null,
        address: orgProfile?.address ?? null,
        email: orgProfile?.email ?? null,
        phone: orgProfile?.phone ?? null,
        userNameOrEmail: userName || null,
      }
      const pdfShowEmitidoPor = showEmitidoParam !== '0' && showEmitidoParam !== 'false'
      const pdfShowFullCompanyData = showFullCompanyParam !== '0' && showFullCompanyParam !== 'false'
      const selectedColumns = columnsParam ? columnsParam.split(',').map((c) => c.trim()) : []
      const includeIncidenciaColumn = selectedColumns.includes('incidenciaPct')

      const page = {
        projectName: project.name,
        projectNumber: project.projectNumber ?? null,
        versionCode: version.versionCode,
        projectInfo,
        rows,
        grandTotal,
      }
      const printOptions = {
        showEmitidoPor: pdfShowEmitidoPor,
        showFullCompanyData: pdfShowFullCompanyData,
        includeIncidenciaColumn,
        locale,
      }
      const html = buildBudgetPrintHtml(layout, page, printOptions)
      const headerTemplate = `<div style="font-size:9px;color:#666;text-align:right;padding:0 20px;">${escapePdfHeader(project.name)}</div>`
      const budgetPdfOptions = {
        ...pdfOptions,
        margin: { top: '60px', right: '10px', bottom: '58px', left: '10px' },
        headerTemplate,
      }
      pdfBuffer = await renderHtmlToPdf(html, baseUrl + '/', budgetPdfOptions)
    } else if (template.id === 'purchase-order' && id) {
      const org = await getOrgContext(session.user.id)
      if (!org) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      let orgProfile: { legalName: string | null; taxId: string | null; country: string | null; address: string | null; email: string | null; phone: string | null } | null = null
      let logoUrl: string | null = null
      try {
        const profile = await prisma.orgProfile.findUnique({
          where: { orgId: org.orgId },
          select: { legalName: true, taxId: true, country: true, address: true, email: true, phone: true, logoStorageKey: true },
        })
        if (profile) {
          orgProfile = {
            legalName: profile.legalName ?? null,
            taxId: profile.taxId ?? null,
            country: profile.country ?? null,
            address: profile.address ?? null,
            email: profile.email ?? null,
            phone: profile.phone ?? null,
          }
          if (profile.logoStorageKey) {
            const url = await getDownloadUrl(profile.logoStorageKey)
            if (url.startsWith('http') || url.startsWith('/')) logoUrl = url
          }
        }
      } catch {
        // optional
      }
      const commitment = await prisma.commitment.findFirst({
        where: { id, orgId: org.orgId, deleted: false },
        include: {
          project: { select: { name: true, projectNumber: true } },
          party: { select: { name: true } },
          lines: {
            orderBy: { sortOrder: 'asc' },
            include: { wbsNode: { select: { code: true } } },
          },
        },
      })
      if (!commitment) {
        return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 })
      }
      const userName = session.user.name ?? session.user.email ?? ''
      const layout = {
        orgName: org.orgName ?? 'Organización',
        orgLegalName: orgProfile?.legalName ?? null,
        logoUrl,
        taxId: orgProfile?.taxId ?? null,
        country: orgProfile?.country ?? null,
        address: orgProfile?.address ?? null,
        email: orgProfile?.email ?? null,
        phone: orgProfile?.phone ?? null,
        userNameOrEmail: userName || null,
      }
      const page = {
        commitmentNumber: commitment.commitmentNumber,
        projectName: commitment.project.name,
        projectNumber: commitment.project.projectNumber ?? null,
        supplierName: commitment.party.name,
        issueDate: commitment.issueDate,
        rows: commitment.lines.map((line) => ({
          description: line.description,
          wbsCode: line.wbsNode?.code ?? '',
          unit: line.unit ?? 'und',
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          totalCost: Number(line.lineTotal),
        })),
        grandTotal: Number(commitment.total),
      }
      const pdfShowEmitidoPor = showEmitidoParam !== '0' && showEmitidoParam !== 'false'
      const pdfShowFullCompanyData = showFullCompanyParam !== '0' && showFullCompanyParam !== 'false'
      const selectedColumns = columnsParam ? columnsParam.split(',').map((c) => c.trim()) : []
      const includeWbsColumn = selectedColumns.includes('wbsCode')
      const html = buildPurchaseOrderPrintHtml(layout, page, {
        showEmitidoPor: pdfShowEmitidoPor,
        showFullCompanyData: pdfShowFullCompanyData,
        includeWbsColumn,
      })
      const headerTemplate = `<div style="font-size:9px;color:#666;text-align:right;padding:0 20px;">${escapePdfHeader(commitment.project.name)} · ${escapePdfHeader(commitment.commitmentNumber)}</div>`
      const poPdfOptions = {
        ...pdfOptions,
        margin: { top: '60px', right: '10px', bottom: '58px', left: '10px' },
        headerTemplate,
      }
      pdfBuffer = await renderHtmlToPdf(html, baseUrl + '/', poPdfOptions)
      const safeNumber = commitment.commitmentNumber.replace(/\s+/g, '_')
      const filename = `orden-compra-${commitment.project.projectNumber}-${safeNumber}.pdf`
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      })
    } else if (template.id === 'schedule' && id) {
      const scheduleMode = request.nextUrl.searchParams.get('mode') === 'view' ? 'view' : 'table'
      const org = await getOrgContext(session.user.id)
      if (!org) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      const schedule = await prisma.schedule.findFirst({
        where: { id, orgId: org.orgId },
        include: {
          project: { select: { name: true, projectNumber: true } },
          tasks: {
            orderBy: [{ wbsNode: { code: 'asc' } }],
            include: {
              wbsNode: { select: { code: true, name: true } },
            },
          },
        },
      })
      if (!schedule) {
        return NextResponse.json({ error: 'Cronograma no encontrado' }, { status: 404 })
      }
      const dateLocalePdf = locale.toLowerCase().startsWith('en') ? 'en-GB' : 'es-AR'
      const fromParam = request.nextUrl.searchParams.get('from')
      const toParam = request.nextUrl.searchParams.get('to')
      const fromDate = fromParam ? new Date(fromParam) : null
      const toDate = toParam ? new Date(toParam) : null
      const filterByRange =
        fromParam &&
        toParam &&
        fromDate &&
        toDate &&
        !Number.isNaN(fromDate.getTime()) &&
        !Number.isNaN(toDate.getTime()) &&
        fromDate.getTime() <= toDate.getTime()
      let tasks = schedule.tasks
      if (filterByRange && fromDate && toDate) {
        const fromMs = fromDate.getTime()
        const toMs = toDate.getTime()
        tasks = tasks.filter((t) => {
          const start = t.plannedStartDate.getTime()
          const end = t.plannedEndDate.getTime()
          return end >= fromMs && start <= toMs
        })
      }
      const dateRangeSubtitle =
        filterByRange && fromDate && toDate
          ? ` (${fromDate.toLocaleDateString(dateLocalePdf, { dateStyle: 'short' })} – ${toDate.toLocaleDateString(dateLocalePdf, { dateStyle: 'short' })})`
          : ''
      const formatShort = (d: Date) =>
        d.toLocaleDateString(dateLocalePdf, { dateStyle: 'short' })
      const rows = tasks.map((t) => ({
        code: t.wbsNode?.code ?? '—',
        name: t.wbsNode?.name ?? '—',
        startDate: formatShort(t.plannedStartDate),
        endDate: formatShort(t.plannedEndDate),
        duration: t.plannedDuration,
        progress: `${Number(t.progressPercent)}%`,
      }))
      let orgProfile: {
        legalName: string | null
        taxId: string | null
        country: string | null
        address: string | null
        email: string | null
        phone: string | null
        logoStorageKey: string | null
      } | null = null
      try {
        const profile = await prisma.orgProfile.findUnique({
          where: { orgId: org.orgId },
          select: {
            legalName: true,
            taxId: true,
            country: true,
            address: true,
            email: true,
            phone: true,
            logoStorageKey: true,
          },
        })
        if (profile) {
          orgProfile = {
            legalName: profile.legalName,
            taxId: profile.taxId,
            country: profile.country,
            address: profile.address,
            email: profile.email,
            phone: profile.phone,
            logoStorageKey: profile.logoStorageKey,
          }
        }
      } catch {
        // optional
      }
      let logoUrl: string | null = null
      if (orgProfile?.logoStorageKey) {
        try {
          const url = await getDownloadUrl(orgProfile.logoStorageKey)
          if (url.startsWith('http') || url.startsWith('/')) logoUrl = url
        } catch {
          // optional
        }
      }
      const userName = session.user.name ?? session.user.email ?? ''
      const layout = {
        orgName: org.orgName ?? 'Organización',
        orgLegalName: orgProfile?.legalName ?? null,
        logoUrl,
        taxId: orgProfile?.taxId ?? null,
        country: orgProfile?.country ?? null,
        address: orgProfile?.address ?? null,
        email: orgProfile?.email ?? null,
        phone: orgProfile?.phone ?? null,
        userNameOrEmail: userName || null,
      }
      const page = {
        projectName: schedule.project.name,
        projectNumber: schedule.project.projectNumber ?? null,
        scheduleName: schedule.name,
        scheduleStatus: schedule.status,
        dateRangeSubtitle: dateRangeSubtitle || undefined,
        rows,
      }
      const pdfShowEmitidoPor = showEmitidoParam !== '0' && showEmitidoParam !== 'false'
      const pdfShowFullCompanyData = showFullCompanyParam !== '0' && showFullCompanyParam !== 'false'
      const html =
        scheduleMode === 'view'
          ? buildScheduleVisualPrintHtml(
              layout,
              {
                projectName: schedule.project.name,
                projectNumber: schedule.project.projectNumber ?? null,
                scheduleName: schedule.name,
                scheduleStatus: schedule.status,
                fromDate:
                  filterByRange && fromDate
                    ? fromDate
                    : new Date(schedule.projectStartDate),
                toDate:
                  filterByRange && toDate
                    ? toDate
                    : new Date(schedule.projectEndDate),
                tasks: tasks.map((t) => ({
                  code: t.wbsNode?.code ?? '—',
                  name: t.wbsNode?.name ?? '—',
                  startDate: t.plannedStartDate,
                  endDate: t.plannedEndDate,
                  progressPercent: Number(t.progressPercent),
                  taskType:
                    (t.taskType as 'TASK' | 'SUMMARY' | 'MILESTONE') ?? 'TASK',
                  isCritical: t.isCritical,
                })),
              },
              {
                showEmitidoPor: pdfShowEmitidoPor,
                showFullCompanyData: pdfShowFullCompanyData,
                locale,
              }
            )
          : buildSchedulePrintHtml(layout, page, {
              showEmitidoPor: pdfShowEmitidoPor,
              showFullCompanyData: pdfShowFullCompanyData,
              locale,
            })
      const scheduleHeaderDoc =
        locale.toLowerCase().startsWith('en') ? 'Schedule' : 'Cronograma'
      const headerTemplate = `<div style="font-size:9px;color:#666;text-align:right;padding:0 20px;">${escapePdfHeader(schedule.project.name)} · ${escapePdfHeader(schedule.name)} · ${escapePdfHeader(scheduleHeaderDoc)}</div>`
      const schedulePdfOptions = {
        ...pdfOptions,
        margin: { top: '60px', right: '10px', bottom: '58px', left: '10px' },
        headerTemplate,
      }
      pdfBuffer = await renderHtmlToPdf(html, baseUrl + '/', schedulePdfOptions)
    } else {
      pdfBuffer = await renderUrlToPdf(
        printUrl,
        cookies,
        pdfOptions,
        rawCookieHeader
      )
    }

    let filename = template.getFileName({ id: id ?? undefined })
    if (template.id === 'schedule' && id) {
      const mode = request.nextUrl.searchParams.get('mode') === 'view' ? 'vista' : 'tabla'
      const from = request.nextUrl.searchParams.get('from')
      const to = request.nextUrl.searchParams.get('to')
      const isoYmd = /^\d{4}-\d{2}-\d{2}$/
      if (from && to && isoYmd.test(from) && isoYmd.test(to)) {
        const safeFrom = from.replace(/-/g, '')
        const safeTo = to.replace(/-/g, '')
        filename = `cronograma-${mode}-${id.slice(0, 8)}-${safeFrom}-a-${safeTo}.pdf`
      }
    }
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al generar el PDF'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[api/pdf]', message, stack ?? '')
    const includeDetail =
      process.env.NODE_ENV === 'development' || process.env.PDF_ERROR_DETAIL === 'true'
    return NextResponse.json(
      {
        error: 'Error al generar el PDF',
        ...(includeDetail && { detail: message }),
      },
      { status: 500 }
    )
  }
}
