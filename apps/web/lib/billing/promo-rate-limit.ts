/** Best-effort sliding window per org + client IP for validatePromo server action (in-memory). */

const windowMs = 60_000
const maxPerWindow = 40
const hits = new Map<string, number[]>()

export function isBillingPromoValidationRateLimited(orgId: string, ip: string | undefined): boolean {
  const key = `${orgId}:${ip ?? 'unknown'}`
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  return list.length > maxPerWindow
}
