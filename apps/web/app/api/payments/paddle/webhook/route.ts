import { NextResponse } from 'next/server'
import { prisma } from '@repo/database'
import { PaddleBillingClient } from '@/lib/billing/providers/paddle.client'
import { handlePaddleWebhookEvent } from '@/lib/billing/webhooks/paddle-handler'
import { isPaddleWebhookRateLimited } from '@/lib/billing/webhook-rate-limit'

const provider = new PaddleBillingClient()

function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: Request) {
  const ip = clientIp(req)
  if (isPaddleWebhookRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate limit' }, { status: 429 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('paddle-signature')
  const verification = await provider.verifyWebhookSignature(rawBody, signature)
  if (!verification.valid) {
    console.warn(JSON.stringify({ scope: 'paddle_webhook', ok: false, reason: 'invalid_signature', ip }))
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 })
  }

  let payload: { event_id: string; event_type: string; data?: Record<string, unknown> }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  try {
    await prisma.billingEventLog.create({
      data: {
        provider: 'PADDLE',
        eventId: payload.event_id,
        eventType: payload.event_type,
        payload: payload as unknown as object,
        status: 'PENDING',
        signatureHash: verification.signatureHash,
      },
    })
  } catch {
    const existing = await prisma.billingEventLog.findUnique({
      where: { eventId: payload.event_id },
      select: { status: true },
    })
    if (existing?.status === 'PROCESSED' || existing?.status === 'IGNORED') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'failed to persist event' }, { status: 500 })
    }
  }

  try {
    await handlePaddleWebhookEvent(payload, verification.signatureHash)
    console.info(
      JSON.stringify({
        scope: 'paddle_webhook',
        ok: true,
        event_id: payload.event_id,
        event_type: payload.event_type,
        ip,
      })
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error(
      JSON.stringify({
        scope: 'paddle_webhook',
        ok: false,
        event_id: payload.event_id,
        event_type: payload.event_type,
        ip,
        error: errMsg,
      })
    )
    await prisma.billingEventLog.updateMany({
      where: { eventId: payload.event_id },
      data: {
        status: 'FAILED',
        processAttempts: { increment: 1 },
        errorMessage: errMsg,
      },
    })
    return NextResponse.json({ ok: false, error: 'processing failed' }, { status: 500 })
  }
}
