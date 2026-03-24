import { headers } from 'next/headers'

/** Client IP from proxy headers (Vercel, etc.). */
export async function getRequestIp(): Promise<string | undefined> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    const real = h.get('x-real-ip')
    return forwarded?.split(',')[0]?.trim() ?? real ?? undefined
  } catch {
    return undefined
  }
}
