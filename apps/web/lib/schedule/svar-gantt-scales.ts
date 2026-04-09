import type { IScaleConfig } from '@svar-ui/react-gantt'
import { format, isFirstDayOfMonth } from 'date-fns'
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
 * Escalas de cabecera al estilo [SVAR Gantt](https://svar.dev/react/gantt/):
 * fila superior da contexto (mes / año); la fila de día usa números cortos para
 * que no se solapen al reducir el ancho de celda — el detalle está en la fila superior y en el grid.
 */
export function buildSvarScalesForBloqerZoom(
  zoom: 'day' | 'week' | 'month',
  _weekStartsOn: 0 | 1,
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
        format: (d: Date) => format(d, 'd', { locale }),
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
        format: (d: Date) => format(d, 'd', { locale }),
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
        isFirstDayOfMonth(d) ? format(d, 'd', { locale }) : '',
    },
  ]
}

/**
 * Ancho en px por día en el canvas del Gantt (SVAR `cellWidth`).
 * Día = columnas anchas; mes = más días por pantalla con scroll horizontal si hace falta.
 * Requiere `autoScale={false}` en el componente para que se respete.
 */
export function svarCellWidthForZoom(zoom: 'day' | 'week' | 'month'): number {
  switch (zoom) {
    case 'day':
      return 40
    case 'week':
      return 36
    case 'month':
      return 28
    default:
      return 36
  }
}
