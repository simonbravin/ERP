'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { updatePurchaseOrder } from '@/app/actions/materials'
import type { CommitmentDetailWithLines } from '@/app/actions/materials'
import { formatCurrency } from '@/lib/format-utils'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

type WbsNode = { id: string; code: string; name: string }

const inputClassName =
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

interface Props {
  commitment: CommitmentDetailWithLines
  parties: Array<{ id: string; name: string }>
  wbsNodes: WbsNode[]
}

type EditLine = {
  id: string
  wbsNodeId: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
}

export function PurchaseOrderEditForm({ commitment, parties, wbsNodes }: Props) {
  const tFin = useTranslations('finance')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [partyId, setPartyId] = useState(commitment.partyId)
  const [issueDate, setIssueDate] = useState(
    new Date(commitment.issueDate).toISOString().slice(0, 10)
  )
  const [description, setDescription] = useState(commitment.description ?? '')
  const [lines, setLines] = useState<EditLine[]>(
    commitment.lines.map((l) => ({
      id: l.id,
      wbsNodeId: l.wbsNodeId ?? '',
      description: l.description,
      unit: l.unit ?? 'und',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }))
  )

  function addLine() {
    const firstWbs = wbsNodes[0]?.id ?? ''
    setLines((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        wbsNodeId: firstWbs,
        description: '',
        unit: 'und',
        quantity: 0,
        unitPrice: 0,
      },
    ])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof EditLine, value: string | number) {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partyId) {
      toast.error(tFin('toast.poSelectSupplier'))
      return
    }
    const validLines = lines.filter(
      (l) => l.wbsNodeId && l.description.trim() && l.quantity > 0 && l.unitPrice >= 0
    )
    if (validLines.length === 0) {
      toast.error(tFin('toast.poLineValidationError'))
      return
    }
    setSubmitting(true)
    const result = await updatePurchaseOrder({
      commitmentId: commitment.id,
      partyId,
      issueDate,
      description: description.trim() || undefined,
      lines: validLines.map((l) => ({
        wbsNodeId: l.wbsNodeId,
        description: l.description.trim(),
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    })
    setSubmitting(false)
    if (result.success === true) {
      toast.success(tFin('toast.poUpdated'))
      router.push(`/projects/${commitment.projectId}/finance/purchase-orders/${commitment.id}`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {tFin('purchaseOrderEdit.title', { number: commitment.commitmentNumber })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground">Proveedor</Label>
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger className={inputClassName}>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{tFin('purchaseOrderEdit.issueDate')}</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputClassName}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">{tFin('purchaseOrderEdit.descriptionOptional')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tFin('purchaseOrderEdit.descriptionPlaceholder')}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">{tFin('purchaseOrderEdit.lines')}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                {tFin('purchaseOrderEdit.addLine')}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-medium text-foreground">
                      {tFin('purchaseOrderEdit.colDescription')}
                    </TableHead>
                    <TableHead className="font-medium text-foreground">{tFin('purchaseOrderEdit.colWbs')}</TableHead>
                    <TableHead className="font-medium text-foreground">{tFin('purchaseOrderEdit.colUnit')}</TableHead>
                    <TableHead className="text-right font-medium text-foreground">
                      {tFin('purchaseOrderEdit.colQuantity')}
                    </TableHead>
                    <TableHead className="text-right font-medium text-foreground">
                      {tFin('purchaseOrderEdit.colUnitPrice')}
                    </TableHead>
                    <TableHead className="text-right font-medium text-foreground">
                      {tFin('purchaseOrderEdit.colTotal')}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={line.id} className="border-border/50">
                      <TableCell className="min-w-[200px]">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder={tFin('purchaseOrderEdit.lineDescriptionPlaceholder')}
                          className="h-9 w-full max-w-full border-input bg-background text-sm"
                        />
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <Select
                          value={line.wbsNodeId}
                          onValueChange={(v) => updateLine(index, 'wbsNodeId', v)}
                        >
                          <SelectTrigger className="h-9 w-full min-w-[140px] border-input bg-background text-sm">
                            <SelectValue placeholder="WBS" />
                          </SelectTrigger>
                          <SelectContent>
                            {wbsNodes.map((n) => (
                              <SelectItem key={n.id} value={n.id}>
                                {n.code} – {n.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.unit}
                          onChange={(e) => updateLine(index, 'unit', e.target.value)}
                          className="h-9 w-full min-w-[4rem] border-input bg-background text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={line.quantity || ''}
                          onChange={(e) =>
                            updateLine(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="h-9 w-24 text-right border-input bg-background text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={line.unitPrice || ''}
                          onChange={(e) =>
                            updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          className="h-9 w-28 text-right border-input bg-background text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(line.quantity * line.unitPrice, commitment.currency)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-right text-sm font-medium tabular-nums text-foreground">
              {tFin('purchaseOrderEdit.totalLabel')}{' '}
              {formatCurrency(total, commitment.currency)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tFin('purchaseOrderEdit.save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  `/projects/${commitment.projectId}/finance/purchase-orders/${commitment.id}`
                )
              }
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
