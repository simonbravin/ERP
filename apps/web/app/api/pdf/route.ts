import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@repo/database'
import { renderUrlToPdf } from '@/lib/pdf/render-pdf'
import { getDocumentTemplate } from '@/lib/pdf/templates'

function getBaseUrl(): string {
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
      { error: 'Parámetros inválidos: template (o doc) e id son requeridos' },
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

  const baseUrl = getBaseUrl()
  const printUrl = template.buildPrintUrl({
    baseUrl,
    locale,
    id: id ?? undefined,
  })
  const cookies = getCookiesFromRequest(request)

  try {
    const pdfBuffer = await renderUrlToPdf(printUrl, cookies, {
      format: 'A4',
      printBackground: true,
    })

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
    return NextResponse.json(
      { error: 'Error al generar el PDF' },
      { status: 500 }
    )
  }
}
