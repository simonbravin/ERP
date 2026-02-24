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
import { getStatusLabel } from '@/lib/finance-labels'
import { toast } from 'sonner'
import { TRANSACTION_STATUS } from '@repo/validators'

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
  const [isPending, setIsPending] = useState(false)
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  async function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) return
    setIsPending(true)
    try {
      const result = await updateProjectTransaction(transactionId, {
        status: newStatus as (typeof TRANSACTION_STATUS)[number],
      })
      if (result && 'error' in result && result.error) {
        const err = result.error as Record<string, string[]>
        toast.error(err._form?.[0] ?? 'No se pudo cambiar el estado')
        return
      }
      if (result && 'transaction' in result && result.transaction) {
        toast.success(`Estado actualizado a ${getStatusLabel(newStatus, transactionType)}`)
        onSuccess(result.transaction as { status: string })
      }
    } catch {
      toast.error('Error al actualizar el estado')
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

  const paidLabel = getStatusLabel('PAID', transactionType)
  const isPaid = currentStatus === 'PAID'

  if (isPaid) {
    return (
      <Badge variant="neutral" className="font-normal">
        {getStatusLabel(currentStatus, transactionType)}
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
                {getStatusLabel(currentStatus, transactionType)}
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
              {getStatusLabel(status, transactionType)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showPaidConfirm} onOpenChange={setShowPaidConfirm}>
        <AlertDialogContent className="max-w-2xl min-w-[min(28rem,95vw)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Confirmar que esta transacción está {paidLabel.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este cambio no se puede deshacer. La transacción quedará marcada como {paidLabel}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStatus && handleStatusChange(pendingStatus)}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
