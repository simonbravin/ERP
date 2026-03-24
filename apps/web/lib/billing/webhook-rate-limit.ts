/** Best-effort per-IP sliding window for POST /api/payments/paddle/webhook (in-memory; resets on cold start). */

const windowMs = 60_000
const maxPerWindow = 120
const hits = new Map<string, number[]>()

export function isPaddleWebhookRateLimited(ip: string): boolean {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(ip, list)
  return list.length > maxPerWindow
}
