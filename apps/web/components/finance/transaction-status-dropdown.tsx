'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updateProjectTransaction } from '@/app/actions/finance'
import { toast } from 'sonner'
import { TRANSACTION_STATUS } from '@repo/validators'
import { useTranslations } from 'next-intl'

interface TransactionStatusDropdownProps {
  transactionId: string
  currentStatus: string
  transactionType?: string
  onSuccess: (updated: { status: string }) => void
}

export function TransactionStatusDropdown({
  transactionId,
  currentStatus,
  transactionType,
  onSuccess,
}: TransactionStatusDropdownProps) {
  const t = useTranslations('finance')
  const tCommon = useTranslations('common')
  const [isPending, setIsPending] = useState(false)
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  function getStatusLabelI18n(status: string): string {
    if (status === 'PAID' && (transactionType === 'INCOME' || transactionType === 'SALE')) {
      return t('statusPaidCollected')
    }
    if (status === 'DRAFT') return t('statuses.DRAFT')
    if (status === 'SUBMITTED') return t('statuses.SUBMITTED')
    if (status === 'APPROVED') return t('statuses.APPROVED')
    if (status === 'PAID') return t('statuses.PAID')
    if (status === 'VOIDED') return t('statuses.VOIDED')
    return status
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) return
    setIsPending(true)
    try {
      const result = await updateProjectTransaction(transactionId, {
        status: newStatus as (typeof TRANSACTION_STATUS)[number],
      })
      if (result && 'error' in result && result.error) {
        const err = result.error as Record<string, string[]>
        toast.error(err._form?.[0] ?? t('toast.statusChangeFailed'))
        return
      }
      if (result && 'transaction' in result && result.transaction) {
        toast.success(
          t('toast.statusUpdated', { status: getStatusLabelI18n(newStatus) })
        )
        onSuccess(result.transaction as { status: string })
      }
    } catch {
      toast.error(t('toast.statusUpdateError'))
    } finally {
      setIsPending(false)
      setShowPaidConfirm(false)
      setPendingStatus(null)
    }
  }

  function onStatusClick(status: string) {
    if (status === currentStatus) return
    if (status === 'PAID') {
      setPendingStatus(status)
      setShowPaidConfirm(true)
      return
    }
    handleStatusChange(status)
  }

  const paidLabel = getStatusLabelI18n('PAID')
  const isPaid = currentStatus === 'PAID'

  if (isPaid) {
    return (
      <Badge variant="neutral" className="font-normal">
        {getStatusLabelI18n(currentStatus)}
      </Badge>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-1 px-2 py-0.5 font-normal"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Badge variant="neutral" className="font-normal">
                {getStatusLabelI18n(currentStatus)}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TRANSACTION_STATUS.map((status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => onStatusClick(status)}
              disabled={status === currentStatus}
            >
              {getStatusLabelI18n(status)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showPaidConfirm} onOpenChange={setShowPaidConfirm}>
        <AlertDialogContent className="max-w-2xl min-w-[min(28rem,95vw)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('confirmPaidTitle', { status: paidLabel.toLowerCase() })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmPaidDescription', { status: paidLabel })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStatus && handleStatusChange(pendingStatus)}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                tCommon('confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
