'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from 'sonner'
import { updateBudgetVersionStatus } from '@/app/actions/budget'
import { Loader2, Lock, CheckCircle2, FileEdit } from 'lucide-react'

interface BudgetVersionStatusDropdownProps {
  versionId: string
  projectId: string
  currentStatus: string
  canEdit: boolean
}

export function BudgetVersionStatusDropdown({
  versionId,
  projectId: _projectId,
  currentStatus,
  canEdit,
}: BudgetVersionStatusDropdownProps) {
  const t = useTranslations('budget')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  /** Optimistic status: show new value immediately, revert on server error */
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null)

  const displayStatus = optimisticStatus ?? currentStatus

  const statuses = [
    {
      value: 'DRAFT',
      label: t('statusDraft'),
      icon: FileEdit,
      color: 'bg-muted text-foreground',
      description: t('statusDraftDesc'),
    },
    {
      value: 'BASELINE',
      label: t('statusBaseline'),
      icon: CheckCircle2,
      color: 'bg-blue-100 text-blue-800',
      description: t('statusBaselineDesc'),
    },
    {
      value: 'APPROVED',
      label: t('statusApproved'),
      icon: Lock,
      color: 'bg-green-100 text-green-800',
      description: t('statusApprovedDesc'),
    },
  ]

  const currentStatusData = statuses.find((s) => s.value === displayStatus)

  function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) return

    if (newStatus === 'BASELINE' || newStatus === 'APPROVED') {
      setPendingStatus(newStatus)
      setShowConfirmDialog(true)
    } else {
      confirmStatusChange(newStatus)
    }
  }

  function confirmStatusChange(status: string) {
    setOptimisticStatus(status)
    startTransition(async () => {
      try {
        const result = await updateBudgetVersionStatus(
          versionId,
          status as 'DRAFT' | 'BASELINE' | 'APPROVED'
        )

        if (result.success) {
          toast.success(t('statusUpdated'), { description: t('statusUpdatedDesc') })
          router.refresh()
        } else {
          setOptimisticStatus(null)
          toast.error(t('error'), {
            description: result.error || t('statusUpdateError'),
          })
        }
      } catch {
        setOptimisticStatus(null)
        toast.error(t('error'), { description: t('statusUpdateError') })
      } finally {
        setShowConfirmDialog(false)
        setPendingStatus(null)
      }
    })
  }

  if (!canEdit) {
    const Icon = currentStatusData?.icon ?? FileEdit
    return (
      <Badge className={currentStatusData?.color ?? 'bg-muted text-foreground'}>
        <Icon className="mr-1 h-3 w-3" />
        {currentStatusData?.label ?? displayStatus}
      </Badge>
    )
  }

  const CurrentIcon = currentStatusData?.icon ?? FileEdit

  return (
    <>
      <Select value={displayStatus} onValueChange={handleStatusChange} disabled={isPending}>
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            {isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('updating')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CurrentIcon className="h-4 w-4" />
                <span>{currentStatusData?.label ?? currentStatus}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statuses.map((status) => {
            const Icon = status.icon
            const isDisabled =
              currentStatus === 'APPROVED' ||
              (currentStatus === 'BASELINE' && status.value === 'DRAFT')

            return (
              <SelectItem key={status.value} value={status.value} disabled={isDisabled}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <div>
                    <p className="font-medium">{status.label}</p>
                    <p className="text-xs text-slate-500">{status.description}</p>
                  </div>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-2xl min-w-[min(28rem,95vw)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === 'BASELINE'
                ? t('confirmBaselineTitle')
                : t('confirmApprovalTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === 'BASELINE' ? (
                <div className="space-y-2">
                  <p>{t('confirmBaselineDesc1')}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    <li>{t('confirmBaselineDesc2')}</li>
                    <li>{t('confirmBaselineDesc3')}</li>
                    <li>{t('confirmBaselineDesc4')}</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>{t('confirmApprovalDesc1')}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    <li>{t('confirmApprovalDesc2')}</li>
                    <li>{t('confirmApprovalDesc3')}</li>
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStatus && confirmStatusChange(pendingStatus)}
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
