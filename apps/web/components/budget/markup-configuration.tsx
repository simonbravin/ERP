'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format-utils'
import { updateMarkupMode, updateGlobalMarkups } from '@/app/actions/budget'
import { Loader2, Info, Save } from 'lucide-react'

interface MarkupConfigurationProps {
  versionId: string
  currentMode: string
  currentMarkups: {
    overheadPct: number
    financialPct: number
    profitPct: number
    taxPct: number
  }
  directCostTotal: number
  canEdit: boolean
}

export function MarkupConfiguration({
  versionId,
  currentMode,
  currentMarkups,
  directCostTotal,
  canEdit,
}: MarkupConfigurationProps) {
  const t = useTranslations('budget')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [mode, setMode] = useState<'SIMPLE' | 'ADVANCED'>(
    currentMode as 'SIMPLE' | 'ADVANCED'
  )
  const [markups, setMarkups] = useState(currentMarkups)
  const [showModeChangeConfirm, setShowModeChangeConfirm] = useState(false)
  const [pendingMode, setPendingMode] = useState<'SIMPLE' | 'ADVANCED' | null>(
    null
  )

  // Calcular totales: GG sobre costo directo → Subtotal 1; GF y Beneficio sobre Subtotal 1 → Subtotal 2; IVA sobre Subtotal 2 → Total
  const overheadAmount = directCostTotal * (markups.overheadPct / 100)
  const subtotal1 = directCostTotal + overheadAmount

  const financialAmount = subtotal1 * (markups.financialPct / 100)
  const profitAmount = subtotal1 * (markups.profitPct / 100)
  const subtotal2 = subtotal1 + financialAmount + profitAmount

  const taxAmount = subtotal2 * (markups.taxPct / 100)
  const totalSale = subtotal2 + taxAmount

  function handleModeToggle(newMode: 'SIMPLE' | 'ADVANCED') {
    if (newMode === mode) return

    // Si cambia de ADVANCED a SIMPLE, pedir confirmación
    if (newMode === 'SIMPLE' && mode === 'ADVANCED') {
      setPendingMode(newMode)
      setShowModeChangeConfirm(true)
    } else {
      confirmModeChange(newMode, false)
    }
  }

  function confirmModeChange(
    newMode: 'SIMPLE' | 'ADVANCED',
    applyToAll: boolean
  ) {
    startTransition(async () => {
      try {
        const result = await updateMarkupMode(versionId, newMode, applyToAll)

        if (result.success) {
          setMode(newMode)
          toast.success(
            newMode === 'SIMPLE' ? t('modeSimpleActivated') : t('modeAdvancedActivated')
          )
          router.refresh()
        } else {
          toast.error(result.error || t('modeUpdateError'))
        }
      } catch {
        toast.error(t('modeUpdateError'))
      } finally {
        setShowModeChangeConfirm(false)
        setPendingMode(null)
      }
    })
  }

  function handleSaveMarkups() {
    if (
      markups.overheadPct < 0 ||
      markups.overheadPct > 100 ||
      markups.financialPct < 0 ||
      markups.financialPct > 100 ||
      markups.profitPct < 0 ||
      markups.profitPct > 100 ||
      markups.taxPct < 0 ||
      markups.taxPct > 100
    ) {
      toast.error(t('invalidPercentage'))
      return
    }

    startTransition(async () => {
      try {
        const result = await updateGlobalMarkups(
          versionId,
          markups,
          mode === 'SIMPLE'
        )

        if (result.success) {
          toast.success(t('markupsSavedDesc'))
          router.refresh()
        } else {
          toast.error(result.error || t('markupsSaveError'))
        }
      } catch {
        toast.error(t('markupsSaveError'))
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-3 flex-nowrap">
            <CardTitle className="text-base shrink-0">{t('markupConfiguration')}</CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor="mode-toggle" className="text-xs font-normal whitespace-nowrap">
                {t('simpleMode')}
              </Label>
              <Switch
                id="mode-toggle"
                checked={mode === 'ADVANCED'}
                onCheckedChange={(checked) =>
                  handleModeToggle(checked ? 'ADVANCED' : 'SIMPLE')
                }
                disabled={!canEdit || isPending}
              />
              <Label htmlFor="mode-toggle" className="text-xs font-normal whitespace-nowrap">
                {t('advancedMode')}
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-4 pt-0">
          {!canEdit && (
            <p className="text-sm text-muted-foreground">
              {t('marginsLockedNote')}
            </p>
          )}
          <div className="rounded border border-border bg-muted/50 px-2.5 py-2 text-xs">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              <div>
                {mode === 'SIMPLE' ? (
                  <p className="font-medium text-foreground">{t('simpleModeTitle')}: {t('simpleModeDesc')}</p>
                ) : (
                  <p className="font-medium text-foreground">{t('advancedModeTitle')}: {t('advancedModeDesc')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('globalMarkupsBase')}
              </h3>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="overhead" className="w-36 shrink-0 text-xs">
                    {t('overheadLabel')}
                  </Label>
                  <Input
                    id="overhead"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={markups.overheadPct}
                    onChange={(e) =>
                      setMarkups({
                        ...markups,
                        overheadPct: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!canEdit || isPending}
                    className="h-8 w-20 text-right text-sm"
                  />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(overheadAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="financial" className="w-36 shrink-0 text-xs">
                    {t('financialLabel')}
                  </Label>
                  <Input
                    id="financial"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={markups.financialPct}
                    onChange={(e) =>
                      setMarkups({
                        ...markups,
                        financialPct: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!canEdit || isPending}
                    className="h-8 w-20 text-right text-sm"
                  />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(financialAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="profit" className="w-36 shrink-0 text-xs">
                    {t('profitLabel')}
                  </Label>
                  <Input
                    id="profit"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={markups.profitPct}
                    onChange={(e) =>
                      setMarkups({
                        ...markups,
                        profitPct: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!canEdit || isPending}
                    className="h-8 w-20 text-right text-sm"
                  />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(profitAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="tax" className="w-36 shrink-0 text-xs">
                    {t('taxLabel')}
                  </Label>
                  <Input
                    id="tax"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={markups.taxPct}
                    onChange={(e) =>
                      setMarkups({
                        ...markups,
                        taxPct: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={!canEdit || isPending}
                    className="h-8 w-20 text-right text-sm"
                  />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(taxAmount)}
                  </span>
                </div>
              </div>
              {canEdit && (
                <Button
                  onClick={handleSaveMarkups}
                  disabled={isPending}
                  size="sm"
                  className="mt-1.5 h-8 w-full text-xs"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {t('saving')}
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {mode === 'SIMPLE' ? t('applyToAll') : t('saveGlobals')}
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('calculationBreakdown')}
              </h3>
              <div className="space-y-1.5 rounded border border-border bg-muted/50 p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('directCost')}:</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatCurrency(directCostTotal)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    + {t('overhead')} ({markups.overheadPct}%):
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(overheadAmount)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-border pt-1 text-xs font-medium">
                  <span className="text-foreground">{t('subtotal')} 1:</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(subtotal1)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    + {t('financial')} ({markups.financialPct}%):
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(financialAmount)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    + {t('profit')} ({markups.profitPct}%):
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(profitAmount)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-border pt-1 text-xs font-medium">
                  <span className="text-foreground">{t('subtotal')} 2:</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(subtotal2)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    + {t('tax')} ({markups.taxPct}%):
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(taxAmount)}
                  </span>
                </div>

                <div className="flex justify-between border-t-2 border-border pt-2">
                  <span className="text-sm font-bold text-primary">
                    {t('totalSale')}:
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums text-primary">
                    {formatCurrency(totalSale)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Change Confirmation */}
      <AlertDialog
        open={showModeChangeConfirm}
        onOpenChange={setShowModeChangeConfirm}
      >
        <AlertDialogContent
          className="min-w-0"
          style={{ width: 'min(42rem, 95vw)', maxWidth: '42rem' }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('confirmModeChangeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>{t('confirmModeChangeDesc')}</p>
                <p className="font-semibold text-orange-600">
                  {t('confirmModeChangeWarning')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingMode && confirmModeChange(pendingMode, true)
              }
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                t('applyAndContinue')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
