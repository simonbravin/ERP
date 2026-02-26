import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@repo/database'
import { getOrgContext } from '@/lib/org-context'
import { getBudgetVersion, listBudgetLines } from '@/app/actions/budget'
import { getProject } from '@/app/actions/projects'
import { getDownloadUrl } from '@/lib/r2-client'
import { buildBudgetPrintHtml } from '@/lib/pdf/build-budget-print-html'
import { renderUrlToPdf, renderHtmlToPdf } from '@/lib/pdf/render-pdf'
import { getDocumentTemplate } from '@/lib/pdf/templates'

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
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const member = await prisma.orgMember.findFirst({
    where: { userId: token.sub, active: true },
    select: { id: true, orgId: true },
  })
  if (!member) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const templateParam = request.nextUrl.searchParams.get('template')
  const docParam = request.nextUrl.searchParams.get('doc')
  const templateId = templateParam ?? docParam
  const id = request.nextUrl.searchParams.get('id')
  const locale = request.nextUrl.searchParams.get('locale') || 'es'

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

  const session = { userId: token.sub, orgId: member.orgId }

  try {
    await template.validateAccess({ session, id: id ?? undefined })
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
  const pdfOptions = { format: 'A4' as const, printBackground: true }

  try {
    let pdfBuffer: Buffer

    if (template.id === 'budget' && id) {
      const org = await getOrgContext(token.sub)
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
      const version = await getBudgetVersion(id)
      if (!version) {
        return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
      }
      const project = await getProject(version.projectId)
      if (!project) {
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      }
      const lines = await listBudgetLines(id) ?? []
      const rows = lines.map((line: { wbsNode?: { code: string; name: string } | null; quantity: number; unit: string | null; description: string | null; directCostTotal?: unknown }) => {
        const qty = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity) || 1
        const total = Number((line as { directCostTotal?: number }).directCostTotal ?? 0)
        const unitPrice = qty > 0 ? total / qty : 0
        const wbs = line.wbsNode
        return {
          code: wbs?.code ?? '—',
          description: line.description ?? wbs?.name ?? '—',
          unit: line.unit ?? '—',
          quantity: qty,
          unitPrice,
          totalCost: total,
        }
      })
      const grandTotal = rows.reduce((sum, r) => sum + r.totalCost, 0)
      const userName = (token as { name?: string }).name ?? (token as { email?: string }).email ?? ''
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
        surfaceM2: (project as { m2?: number | null }).m2 != null ? String((project as { m2: number }).m2) : null,
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
      const page = {
        projectName: project.name,
        projectNumber: project.projectNumber ?? null,
        versionCode: version.versionCode,
        projectInfo,
        rows,
        grandTotal,
      }
      const html = buildBudgetPrintHtml(layout, page)
      const budgetPdfOptions = {
        ...pdfOptions,
        margin: { top: '80px', right: '30px', bottom: '70px', left: '30px' },
      }
      pdfBuffer = await renderHtmlToPdf(html, baseUrl + '/', budgetPdfOptions)
    } else {
      pdfBuffer = await renderUrlToPdf(
        printUrl,
        cookies,
        pdfOptions,
        rawCookieHeader
      )
    }

    const filename = template.getFileName({ id: id ?? undefined })
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[api/pdf]', err)
    const message = err instanceof Error ? err.message : 'Error al generar el PDF'
    const detail = process.env.NODE_ENV === 'development' ? message : undefined
    return NextResponse.json(
      { error: 'Error al generar el PDF', ...(detail && { detail }) },
      { status: 500 }
    )
  }
}
