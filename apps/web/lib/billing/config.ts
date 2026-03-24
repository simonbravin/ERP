/**
 * When false (default), organizations without an OrganizationSubscription row
 * still get full write access (legacy / pre-Paddle), using Organization.subscription* only for UX.
 * Set to true in production after Paddle rollout + backfill.
 */
export function isBillingEnforcementEnabled(): boolean {
  return process.env.BILLING_ENFORCEMENT_ENABLED === 'true'
}
