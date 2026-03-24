'use client'

import { toast } from 'sonner'
import { extractBillingBlockedMessage } from '@/lib/billing/errors'

/** Shows a single error toast when the failure is due to billing read-only enforcement. */
export function toastBillingBlockedIfNeeded(
  err: unknown,
  fallbackMessage?: string,
  /** When set, shown instead of the server message for billing read-only (e.g. next-intl). */
  localizedReadOnlyMessage?: string
): boolean {
  const msg = extractBillingBlockedMessage(err)
  if (msg) {
    toast.error(localizedReadOnlyMessage ?? msg)
    return true
  }
  if (fallbackMessage) toast.error(fallbackMessage)
  return false
}
