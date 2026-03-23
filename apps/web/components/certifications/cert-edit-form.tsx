'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateCertification } from '@/app/actions/certifications'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i)

type CertEditFormProps = {
  certId: string
  projectId: string
  defaultValues: {
    notes: string
    periodMonth: number
    periodYear: number
    issuedDate: string
  }
  backHref: string
}

export function CertEditForm({
  certId,
  projectId: _projectId,
  defaultValues,
  backHref,
}: CertEditFormProps) {
  const router = useRouter()
  const [notes, setNotes] = useState(defaultValues.notes)
  const [periodMonth, setPeriodMonth] = useState(defaultValues.periodMonth)
  const [periodYear, setPeriodYear] = useState(defaultValues.periodYear)
  const [issuedDate, setIssuedDate] = useState(defaultValues.issuedDate)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await updateCertification(certId, {
        notes: notes || undefined,
        periodMonth,
        periodYear,
        issuedDate: issuedDate || undefined,
      })
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

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
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          placeholder="Notas opcionales"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Link href={backHref}>
          <Button type="button" variant="outline">Cancelar</Button>
        </Link>
      </div>
    </form>
  )
}
