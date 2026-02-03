'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { ExcelParser } from '@/lib/excel/excel-parser'
import { importBudgetFromExcel } from '@/app/actions/import-budget'
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { ParsedWbsItem, ImportWarning } from '@/lib/types/excel-import'
import { formatCurrency } from '@/lib/format-utils'

export function ImportBudgetWizard() {
  const t = useTranslations('projects')
  const router = useRouter()

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload')
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [location, setLocation] = useState('')
  const [parsedItems, setParsedItems] = useState<ParsedWbsItem[]>([])
  const [warnings, setWarnings] = useState<ImportWarning[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError(null)

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError(t('fileFormatError', { defaultValue: 'Solo se permiten archivos Excel (.xlsx, .xls)' }))
      return
    }

    try {
      const parser = new ExcelParser()
      const rows = await parser.parseFile(selectedFile)

      if (rows.length === 0) {
        setError(t('importError', { defaultValue: 'El archivo no contiene datos válidos' }))
        return
      }

      const tree = parser.buildTree(rows)
      const parserWarnings = parser.getWarnings()
      const total = calculateTotal(tree)

      setParsedItems(tree)
      setWarnings(parserWarnings)
      setTotalAmount(total)
      setProjectName(selectedFile.name.replace(/\.(xlsx|xls)$/i, ''))
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importError', { defaultValue: 'Error al procesar el archivo' }))
    }
  }

  function calculateTotal(items: ParsedWbsItem[]): number {
    let sum = 0
    for (const item of items) {
      if (item.isLeaf) sum += item.amount
      sum += calculateTotal(item.children)
    }
    return sum
  }

  function countItems(items: ParsedWbsItem[]): number {
    let count = items.length
    for (const item of items) {
      count += countItems(item.children)
    }
    return count
  }

  async function handleImport() {
    if (!projectName.trim()) {
      toast.error(t('projectNameRequired', { defaultValue: 'Debes ingresar un nombre de proyecto' }))
      return
    }

    setStep('importing')

    try {
      const result = await importBudgetFromExcel({
        projectName: projectName.trim(),
        clientName: clientName.trim() || undefined,
        location: location.trim() || undefined,
        items: parsedItems,
      })

      if (result.success && result.projectId) {
        setStep('success')
        toast.success(t('importSuccess', { defaultValue: 'Presupuesto importado exitosamente' }))
        setTimeout(() => {
          router.push(`/projects/${result.projectId}`)
        }, 1500)
      } else {
        toast.error(result.error ?? t('importError', { defaultValue: 'Error al importar presupuesto' }))
        setStep('preview')
      }
    } catch {
      toast.error(t('importError', { defaultValue: 'Error al importar presupuesto' }))
      setStep('preview')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('importBudget', { defaultValue: 'Importar Presupuesto desde Excel' })}</CardTitle>
            <CardDescription>
              {t('importBudgetDesc', { defaultValue: 'Sube un archivo Excel con el formato oficial de presupuesto' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-12 dark:border-slate-600">
              <FileSpreadsheet className="mb-4 h-12 w-12 text-slate-400" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t('selectFile', { defaultValue: 'Click para seleccionar archivo' })}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">.xlsx, .xls</p>
                </div>
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                {t('expectedFormat', { defaultValue: 'Formato esperado' })}:
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>• Código jerárquico (ej: ARQ 1, ARQ 1.1, ARQ 1.1.1)</li>
                <li>• Descripción del item</li>
                <li>• Unidad de medida (m2, m3, gl, etc.)</li>
                <li>• Cantidad (opcional)</li>
                <li>• Importe total</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('projectData', { defaultValue: 'Datos del Proyecto' })}</CardTitle>
              <CardDescription>
                {t('projectDataDesc', { defaultValue: 'Completa la información básica del proyecto' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="projectName">{t('projectName')} *</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1"
                  placeholder="Ej: Comisaría Seccional 5ta"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">{t('clientName')}</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="mt-1"
                    placeholder={t('optional', { defaultValue: 'Opcional' })}
                  />
                </div>
                <div>
                  <Label htmlFor="location">{t('location')}</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1"
                    placeholder={t('optional', { defaultValue: 'Opcional' })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('previewBudget', { defaultValue: 'Vista Previa del Presupuesto' })}</CardTitle>
              <CardDescription>
                {t('totalItems', { defaultValue: 'Items totales' })}: {countItems(parsedItems)} •{' '}
                {t('total', { defaultValue: 'Total' })}: {formatCurrency(totalAmount)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">
                      {t('warnings', { defaultValue: 'Advertencias' })} ({warnings.length}):
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {warnings.slice(0, 5).map((w, idx) => (
                        <li key={idx}>
                          • Fila {w.rowNumber}: {w.message}
                        </li>
                      ))}
                      {warnings.length > 5 && (
                        <li className="text-slate-500">... y {warnings.length - 5} más</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                {parsedItems.map((item) => (
                  <TreeNode key={item.code} item={item} level={0} />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('upload')}>
              {t('cancel')}
            </Button>
            <Button onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              {t('importBudget', { defaultValue: 'Importar Presupuesto' })}
            </Button>
          </div>
        </>
      )}

      {step === 'importing' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
              {t('importingBudget', { defaultValue: 'Importando presupuesto...' })}
            </p>
            <p className="mt-1 text-sm text-slate-500">{t('importingDesc', { defaultValue: 'Esto puede tomar unos momentos' })}</p>
          </CardContent>
        </Card>
      )}

      {step === 'success' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
              {t('importSuccess', { defaultValue: '¡Presupuesto importado exitosamente!' })}
            </p>
            <p className="mt-1 text-sm text-slate-500">{t('redirecting', { defaultValue: 'Redirigiendo al proyecto...' })}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TreeNode({ item, level }: { item: ParsedWbsItem; level: number }) {
  const [isOpen, setIsOpen] = useState(level < 2)

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        {item.children.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {isOpen ? '▼' : '▶'}
          </button>
        )}
        <span className="font-mono text-xs text-slate-500">{item.code}</span>
        <span className="flex-1 text-sm">{item.name}</span>
        {item.unit && (
          <span className="text-xs text-slate-500">
            {item.quantity} {item.unit}
          </span>
        )}
        {item.amount > 0 && (
          <span className="text-sm font-medium tabular-nums">{formatCurrency(item.amount)}</span>
        )}
      </div>
      {isOpen &&
        item.children.map((child) => (
          <TreeNode key={child.code} item={child} level={level + 1} />
        ))}
    </div>
  )
}
