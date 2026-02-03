'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LaborEntryInput } from '@repo/validators'

type LaborEntriesTableProps = {
  value: LaborEntryInput[]
  onChange: (entries: LaborEntryInput[]) => void
  disabled?: boolean
}

export function LaborEntriesTable({ value, onChange, disabled }: LaborEntriesTableProps) {
  const t = useTranslations('dailyReports')
  const tCommon = useTranslations('common')

  const addRow = () => {
    onChange([...value, { speciality: '', quantity: 1, hours: 8 }])
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, field: keyof LaborEntryInput, val: string | number) => {
    const next = [...value]
    next[index] = { ...next[index], [field]: val }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('labor')}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            {t('addLaborRow')}
          </Button>
        )}
      </div>
      <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{t('speciality')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-24">{t('quantity')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-24">{t('hours')}</th>
              {!disabled && <th className="w-16 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {value.length === 0 && (
              <tr>
                <td colSpan={disabled ? 3 : 4} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('addLaborRow')} para agregar filas
                </td>
              </tr>
            )}
            {value.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2">
                  <Input
                    value={row.speciality}
                    onChange={(e) => updateRow(i, 'speciality', e.target.value)}
                    placeholder="Albañil, Oficial..."
                    disabled={disabled}
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => updateRow(i, 'quantity', parseInt(e.target.value, 10) || 0)}
                    disabled={disabled}
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={row.hours}
                    onChange={(e) => updateRow(i, 'hours', parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="h-8"
                  />
                </td>
                {!disabled && (
                  <td className="px-3 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}>
                      {tCommon('remove')}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
