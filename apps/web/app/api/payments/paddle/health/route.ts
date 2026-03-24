import { NextResponse } from 'next/server'

export async function GET() {
  const ok = Boolean(process.env.PADDLE_API_KEY && process.env.PADDLE_WEBHOOK_SECRET)
  return NextResponse.json({
    ok,
    provider: 'paddle',
    env: process.env.PADDLE_ENV ?? 'sandbox',
  })
}
