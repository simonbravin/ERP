import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { wrapEmailWithTemplate } from '@/lib/email'

export const dynamic = 'force-dynamic'

const FROM_EMAIL =
  process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? 'Bloqer <noreply@bloqer.app>'

/**
 * POST /api/email/test
 * Sends a test email using the shared Bloqer template.
 * Allowed only in development, or when EMAIL_TEST_SECRET is set and provided (query or header).
 * Body: { "to": "email@example.com" }
 */
export async function POST(request: Request) {
  const isDev = process.env.NODE_ENV === 'development'
  const secret = process.env.EMAIL_TEST_SECRET?.trim()
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret') ?? request.headers.get('x-email-test-secret') ?? ''
  const allowed = isDev || (secret && secret.length > 0 && querySecret === secret)

  if (!allowed) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: { to?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!to) {
    return NextResponse.json({ error: 'Falta "to" en el body' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY no configurada' },
      { status: 500 }
    )
  }

  const content = `
    <p style="margin:0 0 12px;">Si recibes este correo, el envío con Resend y la plantilla de Bloqer funcionan correctamente.</p>
  `.trim()

  const resend = new Resend(apiKey)
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Prueba Bloqer',
      html: wrapEmailWithTemplate(content),
    })
    if (error) {
      console.error('Test email error:', error)
      return NextResponse.json(
        { error: 'Error al enviar', message: (error as { message?: string }).message },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Test email error:', err)
    return NextResponse.json(
      { error: 'Error al enviar', message: String(err) },
      { status: 500 }
    )
  }
}
