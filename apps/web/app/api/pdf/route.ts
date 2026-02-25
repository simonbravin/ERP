import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@repo/database'
import { renderUrlToPdf } from '@/lib/pdf/render-pdf'

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

  const doc = request.nextUrl.searchParams.get('doc')
  const id = request.nextUrl.searchParams.get('id')
  const locale = request.nextUrl.searchParams.get('locale') || 'es'

  if (doc !== 'computo' || !id) {
    return NextResponse.json(
      { error: 'Parámetros inválidos: doc e id son requeridos' },
      { status: 400 }
    )
  }

  if (doc === 'computo') {
    const version = await prisma.budgetVersion.findFirst({
      where: { id, orgId: member.orgId },
      select: { id: true },
    })
    if (!version) {
      return NextResponse.json(
        { error: 'Versión no encontrada o sin acceso' },
        { status: 404 }
      )
    }
  }

  const baseUrl = getBaseUrl()
  const printUrl = `${baseUrl}/${locale}/print/computo/${id}`
  const cookies = getCookiesFromRequest(request)

  try {
    const pdfBuffer = await renderUrlToPdf(printUrl, cookies, {
      format: 'A4',
      printBackground: true,
    })

    const filename = `computo-${id}.pdf`
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
