'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updateProjectTransaction } from '@/app/actions/finance'
import { STATUS_LABELS } from '@/lib/finance-labels'
import { toast } from 'sonner'
import { TRANSACTION_STATUS } from '@repo/validators'

interface TransactionStatusDropdownProps {
  transactionId: string
  currentStatus: string
  onSuccess: (updated: { status: string }) => void
}

export function TransactionStatusDropdown({
  transactionId,
  currentStatus,
  onSuccess,
}: TransactionStatusDropdownProps) {
  const [isPending, setIsPending] = useState(false)

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
        toast.success(`Estado actualizado a ${STATUS_LABELS[newStatus] ?? newStatus}`)
        onSuccess(result.transaction as { status: string })
      }
    } catch {
      toast.error('Error al actualizar el estado')
    } finally {
      setIsPending(false)
    }
  }

  return (
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
              {STATUS_LABELS[currentStatus] ?? currentStatus}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {TRANSACTION_STATUS.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status)}
            disabled={status === currentStatus}
          >
            {STATUS_LABELS[status] ?? status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
