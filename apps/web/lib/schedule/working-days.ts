import { addDays, isWeekend } from 'date-fns'

export type WorkingDayOptions = {
  nonWorkingDates?: Date[] | string[]
}

function toLocalYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseYmdAsLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null
  const local = new Date(y, mo - 1, d)
  return Number.isNaN(local.getTime()) ? null : local
}

function buildNonWorkingSet(options?: WorkingDayOptions): Set<string> | null {
  const dates = options?.nonWorkingDates
  if (!dates || dates.length === 0) return null
  const set = new Set<string>()
  for (const raw of dates) {
    if (raw instanceof Date) {
      if (!Number.isNaN(raw.getTime())) set.add(toLocalYmd(raw))
      continue
    }
    const parsed = parseYmdAsLocal(raw) ?? new Date(raw)
    if (!Number.isNaN(parsed.getTime())) set.add(toLocalYmd(parsed))
  }
  return set.size > 0 ? set : null
}

/**
 * Verificar si una fecha es día laborable
 * @param date - Fecha a verificar
 * @param workingDaysPerWeek - Días laborables por semana (5, 6 o 7)
 * @param options - Opciones de calendario (feriados/excepciones no laborables)
 * @returns true si es día laborable
 */
export function isWorkingDay(
  date: Date,
  workingDaysPerWeek: number = 6,
  options?: WorkingDayOptions
): boolean {
  const nonWorkingSet = buildNonWorkingSet(options)
  if (nonWorkingSet?.has(toLocalYmd(date))) return false
  const dayOfWeek = date.getDay() // 0 = Domingo, 6 = Sábado

  if (workingDaysPerWeek === 7) {
    return true
  }
  if (workingDaysPerWeek === 6) {
    return dayOfWeek !== 0
  }
  if (workingDaysPerWeek === 5) {
    return !isWeekend(date)
  }
  return true
}

/**
 * Agregar días laborables a una fecha
 * @param startDate - Fecha de inicio
 * @param days - Cantidad de días laborables a agregar (negativo = restar)
 * @param workingDaysPerWeek - Días laborables por semana (5, 6 o 7)
 * @param options - Opciones de calendario (feriados/excepciones no laborables)
 * @returns Nueva fecha después de agregar días laborables
 */
export function addWorkingDays(
  startDate: Date,
  days: number,
  workingDaysPerWeek: number = 6,
  options?: WorkingDayOptions
): Date {
  if (days === 0) return new Date(startDate)

  let date = new Date(startDate)
  let daysAdded = 0
  const increment = days > 0 ? 1 : -1
  const targetDays = Math.abs(days)

  while (daysAdded < targetDays) {
    date = addDays(date, increment)
    if (isWorkingDay(date, workingDaysPerWeek, options)) {
      daysAdded++
    }
  }

  return date
}

/**
 * Calcular días laborables entre dos fechas
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin
 * @param workingDaysPerWeek - Días laborables por semana
 * @param options - Opciones de calendario (feriados/excepciones no laborables)
 * @returns Cantidad de días laborables entre las fechas (negativo si startDate > endDate)
 */
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  workingDaysPerWeek: number = 6,
  options?: WorkingDayOptions
): number {
  if (startDate > endDate) {
    return -countWorkingDays(endDate, startDate, workingDaysPerWeek, options)
  }

  let count = 0
  let currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    if (isWorkingDay(currentDate, workingDaysPerWeek, options)) {
      count++
    }
    currentDate = addDays(currentDate, 1)
  }

  return count
}

/**
 * Obtener el siguiente día laborable
 * @param date - Fecha de referencia
 * @param workingDaysPerWeek - Días laborables por semana
 * @param options - Opciones de calendario (feriados/excepciones no laborables)
 * @returns Siguiente día laborable
 */
export function getNextWorkingDay(
  date: Date,
  workingDaysPerWeek: number = 6,
  options?: WorkingDayOptions
): Date {
  let nextDay = addDays(date, 1)
  while (!isWorkingDay(nextDay, workingDaysPerWeek, options)) {
    nextDay = addDays(nextDay, 1)
  }
  return nextDay
}

/**
 * Obtener el día laborable anterior
 * @param date - Fecha de referencia
 * @param workingDaysPerWeek - Días laborables por semana
 * @param options - Opciones de calendario (feriados/excepciones no laborables)
 * @returns Día laborable anterior
 */
export function getPreviousWorkingDay(
  date: Date,
  workingDaysPerWeek: number = 6,
  options?: WorkingDayOptions
): Date {
  let prevDay = addDays(date, -1)
  while (!isWorkingDay(prevDay, workingDaysPerWeek, options)) {
    prevDay = addDays(prevDay, -1)
  }
  return prevDay
}
