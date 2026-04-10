import type { IScaleConfig } from '@svar-ui/react-gantt'
import { endOfWeek, format, isFirstDayOfMonth, subMilliseconds } from 'date-fns'
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
 * - **Día:** mes + número de día (compacto).
 * - **Semana:** mes + rango por semana (`unit: week`); combinar con `lengthUnit="week"` en el Gantt.
 * - **Mes:** año + mes + marcas de día al inicio de mes.
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
        format: (d: Date) => format(d, 'd', { locale }),
      },
    ]
  }

  if (zoom === 'week') {
    const weekStartsOnOpt = weekStartsOn === 0 ? 0 : 1
    return [
      {
        unit: 'month',
        step: 1,
        format: (d: Date) => format(d, 'MMMM yyyy', { locale }),
      },
      {
        unit: 'week',
        step: 1,
        format: (d: Date, next?: Date) => {
          const weekEnd = next
            ? subMilliseconds(next, 1)
            : endOfWeek(d, { weekStartsOn: weekStartsOnOpt })
          const sameMonth =
            d.getMonth() === weekEnd.getMonth() && d.getFullYear() === weekEnd.getFullYear()
          if (sameMonth) {
            return `${format(d, 'd', { locale })}–${format(weekEnd, 'd MMM', { locale })}`
          }
          return `${format(d, 'd MMM', { locale })} – ${format(weekEnd, 'd MMM', { locale })}`
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
      return 64
    case 'month':
      return 28
    default:
      return 36
  }
}
