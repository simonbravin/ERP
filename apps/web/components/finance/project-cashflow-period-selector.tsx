'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Props {
  range: { from: Date; to: Date }
}

export function ProjectCashflowPeriodSelector({ range }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const preset = useMemo(() => {
    const to = range.to.getTime()
    const from = range.from.getTime()
    const months6 = 6 * 30 * 24 * 60 * 60 * 1000
    const months3 = 3 * 30 * 24 * 60 * 60 * 1000
    const months12 = 12 * 30 * 24 * 60 * 60 * 1000
    const diff = to - from
    if (diff <= months3 + 86400000) return '3months'
    if (diff <= months6 + 86400000) return '6months'
    if (diff <= months12 + 86400000) return '12months'
    return 'custom'
  }, [range.from, range.to])

  const [customFrom, setCustomFrom] = useState(range.from.toISOString().slice(0, 10))
  const [customTo, setCustomTo] = useState(range.to.toISOString().slice(0, 10))
  useEffect(() => {
    setCustomFrom(range.from.toISOString().slice(0, 10))
    setCustomTo(range.to.toISOString().slice(0, 10))
  }, [range.from.getTime(), range.to.getTime()])

  const setRange = useCallback(
    (from: Date, to: Date) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('from', from.toISOString().slice(0, 10))
      params.set('to', to.toISOString().slice(0, 10))
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  function handlePresetChange(value: string) {
    if (value === 'custom') return
    const to = new Date()
    let from: Date
    switch (value) {
      case '3months':
        from = new Date(to.getFullYear(), to.getMonth() - 3, 1)
        break
      case '6months':
        from = new Date(to.getFullYear(), to.getMonth() - 6, 1)
        break
      case '12months':
        from = new Date(to.getFullYear(), to.getMonth() - 12, 1)
        break
      default:
        return
    }
    setRange(from, to)
  }

  function handleCustomApply() {
    const from = new Date(customFrom)
    const to = new Date(customTo)
    if (from <= to) setRange(from, to)
  }

  const periodLabel =
    range.from.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' – ' +
    range.to.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium text-muted-foreground">Período</Label>
        <p className="text-sm font-semibold text-foreground">{periodLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rango" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3months" onSelect={() => handlePresetChange('3months')}>
              Últimos 3 meses
            </SelectItem>
            <SelectItem value="6months" onSelect={() => handlePresetChange('6months')}>
              Últimos 6 meses
            </SelectItem>
            <SelectItem value="12months" onSelect={() => handlePresetChange('12months')}>
              Último año
            </SelectItem>
            <SelectItem value="custom" onSelect={() => handlePresetChange('custom')}>
              Personalizado
            </SelectItem>
          </SelectContent>
        </Select>
        {preset === 'custom' && (
          <>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-[140px]"
              aria-label="Desde"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-[140px]"
              aria-label="Hasta"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCustomApply}
              disabled={!customFrom || !customTo}
            >
              Aplicar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
