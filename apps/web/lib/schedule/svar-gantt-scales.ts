import type { IScaleConfig } from '@svar-ui/react-gantt'
import {
  format,
  startOfWeek,
  isSameDay,
  isFirstDayOfMonth,
} from 'date-fns'
import type { Locale } from 'date-fns'

/**
 * Interpreta fechas plan del cronograma como día civil local (evita corrimientos UTC en ISO `...T00:00:00.000Z`).
 * Si el string empieza con YYYY-MM-DD, usa ese calendario a mediodía local.
 */
export function parseSchedulePlanDate(iso: string): Date {
  const trimmed = iso.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    return new Date(y, mo, d, 12, 0, 0, 0)
  }
  const t = Date.parse(trimmed)
  return new Date(Number.isNaN(t) ? Date.now() : t)
}

/**
 * Escalas de cabecera alineadas al Gantt canvas de Bloqer:
 * - día: mes arriba + dd/MM/yyyy por columna
 * - semana: mes arriba + dd/MM/yyyy solo en el inicio de semana (weekStartsOn)
 * - mes: año + mes (la línea temporal sigue siendo por día, como el canvas)
 */
export function buildSvarScalesForBloqerZoom(
  zoom: 'day' | 'week' | 'month',
  weekStartsOn: 0 | 1,
  locale: Locale
): IScaleConfig[] {
  if (zoom === 'day') {
    return [
      {
        unit: 'month',
        step: 1,
        format: (d: Date) => format(d, 'MMMM yyyy', { locale }),
      },
      {
        unit: 'day',
        step: 1,
        format: (d: Date) => format(d, 'dd/MM/yyyy', { locale }),
      },
    ]
  }

  if (zoom === 'week') {
    return [
      {
        unit: 'month',
        step: 1,
        format: (d: Date) => format(d, 'MMMM yyyy', { locale }),
      },
      {
        unit: 'day',
        step: 1,
        format: (d: Date) => {
          const wk = startOfWeek(d, { weekStartsOn })
          return isSameDay(d, wk) ? format(d, 'dd/MM/yyyy', { locale }) : ''
        },
      },
    ]
  }

  return [
    {
      unit: 'year',
      step: 1,
      format: (d: Date) => format(d, 'yyyy', { locale }),
    },
    {
      unit: 'month',
      step: 1,
      format: (d: Date) => format(d, 'MMMM yyyy', { locale }),
    },
    {
      unit: 'day',
      step: 1,
      format: (d: Date) =>
        isFirstDayOfMonth(d) ? format(d, 'dd/MM/yyyy', { locale }) : '',
    },
  ]
}

/** Ancho de celda por zoom (día = más ancho; mes = más fino), coherente con “más días visibles = celdas más angostas”. */
export function svarCellWidthForZoom(zoom: 'day' | 'week' | 'month'): number {
  switch (zoom) {
    case 'day':
      return 56
    case 'week':
      return 40
    case 'month':
      return 28
    default:
      return 40
  }
}
