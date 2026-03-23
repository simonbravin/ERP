'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

export type ExportFormat = 'excel' | 'csv' | 'pdf'

export interface ExportDropdownProps {
  /** Which formats to offer. If length is 1, render a single button; otherwise a dropdown. */
  formats: ExportFormat[]
  /** Called when user selects a format. Return promise that resolves when done (or reject on error). */
  onExport: (format: ExportFormat) => Promise<void>
  /** When true, disable trigger and show loading state. */
  isLoading?: boolean
  /** Optional label override (default: common.export). */
  label?: string
  /** Button variant. */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Button size. */
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

const formatIcons: Record<ExportFormat, React.ComponentType<{ className?: string }>> = {
  excel: FileSpreadsheet,
  csv: FileSpreadsheet,
  pdf: FileText,
}

export function ExportDropdown({
  formats,
  onExport,
  isLoading = false,
  label,
  variant = 'outline',
  size = 'sm',
  className,
}: ExportDropdownProps) {
  const t = useTranslations('common')
  const [open, setOpen] = useState(false)
  const displayLabel = label ?? t('export')

  async function handleSelect(format: ExportFormat) {
    setOpen(false)
    await onExport(format)
  }

  if (formats.length === 0) return null

  if (formats.length === 1) {
    const format = formats[0]!
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={isLoading}
        onClick={() => onExport(format)}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="mr-2 h-4 w-4" />
        )}
        {isLoading ? t('exporting') : displayLabel}
      </Button>
    )
  }

  const formatLabels: Record<ExportFormat, string> = {
    excel: t('exportExcel'),
    csv: t('exportCsv'),
    pdf: t('exportPdf'),
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          {isLoading ? t('exporting') : displayLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => {
          const Icon = formatIcons[format]
          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleSelect(format)}
              disabled={isLoading}
            >
              {Icon && <Icon className="mr-2 h-4 w-4" />}
              {formatLabels[format]}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
