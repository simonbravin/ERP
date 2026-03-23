'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createCertification,
  addCertificationLine,
  getBudgetLinesForCert,
  getPrevProgressForBudgetLines,
} from '@/app/actions/certifications'

type BudgetVersion = {
  id: string
  versionCode: string
  versionType: string
}

type Project = {
  id: string
  name: string
  budgetVersions: BudgetVersion[]
}

type BudgetLineForCert = {
  id: string
  wbsNodeId: string
  description: string
  quantity: number
  salePriceTotal: number
  wbsNode: { id: string; code: string; name: string } | null
}

type CertFormProps = {
  project: Project
  /** When set (e.g. finance tab), redirect to this base + /{certId} after create */
  successRedirectBasePath?: string
  /** When set, use for Cancel link; else /projects/{id}/certifications */
  cancelHref?: string
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i)

export function CertForm({
  project,
  successRedirectBasePath,
  cancelHref,
}: CertFormProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1)
  const [periodYear, setPeriodYear] = useState(currentYear)
  const [issuedDate, setIssuedDate] = useState<string>('')
  const [budgetVersionId, setBudgetVersionId] = useState(project.budgetVersions[0]?.id ?? '')
  const [notes, setNotes] = useState('')

  const [certId, setCertId] = useState<string | null>(null)
  const [budgetLines, setBudgetLines] = useState<BudgetLineForCert[]>([])
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [progressByLine, setProgressByLine] = useState<Record<string, number>>({})
  const [prevProgressByLine, setPrevProgressByLine] = useState<Record<string, number>>({})

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await createCertification(project.id, {
        periodMonth,
        periodYear,
        budgetVersionId,
        notes: notes || undefined,
        issuedDate: issuedDate || undefined,
      })
      if (result && typeof result === 'object' && 'certId' in result) {
        setCertId(result.certId)
        const lines = await getBudgetLinesForCert(budgetVersionId)
        setBudgetLines(lines as BudgetLineForCert[])
        setSelectedLines(new Set())
        setProgressByLine({})
        setPrevProgressByLine({})
        setStep(2)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create certification')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleLine = (lineId: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const setProgress = (lineId: string, value: number) => {
    const prev = prevProgressByLine[lineId] ?? 0
    const maxPeriod = Math.max(0, 100 - prev)
    const clamped = Math.min(maxPeriod, Math.max(0, value))
    setProgressByLine((p) => ({ ...p, [lineId]: clamped }))
  }

  const handleStep2 = async () => {
    if (selectedLines.size === 0) {
      setError('Seleccioná al menos una partida')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const lineIds = Array.from(selectedLines)
      const prevMap = await getPrevProgressForBudgetLines(budgetVersionId, periodMonth, periodYear, lineIds)
      setPrevProgressByLine(prevMap)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar avance previo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certId) return
    setError(null)
    setSubmitting(true)
    try {
      for (const lineId of selectedLines) {
        const line = budgetLines.find((l) => l.id === lineId)
        if (!line) continue
        const pct = progressByLine[lineId] ?? 0
        await addCertificationLine(certId, {
          wbsNodeId: line.wbsNodeId,
          budgetLineId: line.id,
          periodProgressPct: pct,
        })
      }
      router.push(successRedirectBasePath ? `${successRedirectBasePath}/${certId}` : `/projects/${project.id}/certifications/${certId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add lines')
    } finally {
      setSubmitting(false)
    }
  }

  if (project.budgetVersions.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          No hay versiones de presupuesto. Creá una versión baseline o aprobada primero.
        </p>
        <Link href={`/projects/${project.id}/budget`} className="mt-2 inline-block text-sm font-medium underline">
          Ir a Presupuesto
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex gap-2 text-sm">
        <span className={step >= 1 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'}>1. Período</span>
        <span className="text-gray-400">→</span>
        <span className={step >= 2 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'}>2. Seleccionar partidas</span>
        <span className="text-gray-400">→</span>
        <span className={step >= 3 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'}>3. % Avance</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="periodMonth">Mes</Label>
              <select
                id="periodMonth"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="periodYear">Año</Label>
              <select
                id="periodYear"
                value={periodYear}
                onChange={(e) => setPeriodYear(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="issuedDate">Fecha de emisión (opcional)</Label>
            <Input
              id="issuedDate"
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="budgetVersionId">Versión de presupuesto</Label>
            <select
              id="budgetVersionId"
              value={budgetVersionId}
              onChange={(e) => setBudgetVersionId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              {project.budgetVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versionCode} — {v.versionType}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear y continuar'}
            </Button>
            <Link href={cancelHref ?? `/projects/${project.id}/certifications`}>
              <Button type="button" variant="outline">Cancelar</Button>
            </Link>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select budget lines to include in this certification.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-medium">WBS</th>
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {budgetLines.map((line) => (
                  <tr
                    key={line.id}
                    className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                      selectedLines.has(line.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                    onClick={() => toggleLine(line.id)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedLines.has(line.id)}
                        onChange={() => toggleLine(line.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {line.wbsNode?.code ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{line.description}</td>
                    <td className="text-right tabular-nums px-3 py-2 text-gray-600 dark:text-gray-400">
                      {Number(line.quantity).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleStep2} disabled={selectedLines.size === 0 || submitting}>
              {submitting ? 'Cargando…' : 'Continuar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={handleStep3} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ingresá el % de avance del período por partida. El total (previo + período) no puede superar 100%.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/50">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left font-medium">WBS</th>
                  <th className="px-3 py-2 text-left font-medium">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium">% Prev.</th>
                  <th className="px-3 py-2 text-right font-medium">% Período (máx. 100 − prev)</th>
                </tr>
              </thead>
              <tbody>
                {budgetLines
                  .filter((l) => selectedLines.has(l.id))
                  .map((line) => {
                    const prev = prevProgressByLine[line.id] ?? 0
                    const maxPeriod = Math.max(0, 100 - prev)
                    const value = progressByLine[line.id] ?? ''
                    return (
                    <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {line.wbsNode?.code ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{line.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">
                        {prev.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={maxPeriod}
                          step={0.01}
                          placeholder={`0-${maxPeriod.toFixed(0)}`}
                          value={value === '' ? '' : value}
                          onChange={(e) => {
                            const raw = parseFloat(e.target.value) || 0
                            setProgress(line.id, raw)
                          }}
                          className="w-24 text-right"
                        />
                      </td>
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Agregando partidas…' : 'Agregar partidas y finalizar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Atrás
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
