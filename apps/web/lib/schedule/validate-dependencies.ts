import { addWorkingDays } from './working-days'

type DepType = 'FS' | 'SS' | 'FF' | 'SF'

/** Comparación día a día (ignora hora) para evitar falsos positivos por hora del día. */
function toDayStart(d: Date): number {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  return t.getTime()
}

export interface PredecessorDep {
  plannedStartDate: Date
  plannedEndDate: Date
  dependencyType: DepType
  lagDays: number
  /** Optional: predecessor task code/name for error message */
  code?: string
}

export interface SuccessorDep {
  plannedStartDate: Date
  plannedEndDate: Date
  dependencyType: DepType
  lagDays: number
  /** Optional: successor task code/name for error message */
  code?: string
}

/**
 * Validates that proposed task dates respect all predecessor and successor dependencies.
 * Returns { valid: true } or { valid: false, message: string }.
 */
export function validateTaskDatesAgainstDependencies(
  newStart: Date,
  newEnd: Date,
  predecessors: PredecessorDep[],
  successors: SuccessorDep[],
  workingDaysPerWeek: number
): { valid: true } | { valid: false; message: string } {
  for (const p of predecessors) {
    const pStart = new Date(p.plannedStartDate)
    const pEnd = new Date(p.plannedEndDate)
    const lag = p.lagDays
    const refDate = p.dependencyType === 'FS' || p.dependencyType === 'FF' ? pEnd : pStart
    const minDate = addWorkingDays(refDate, lag, workingDaysPerWeek)

    if (p.dependencyType === 'FS' || p.dependencyType === 'SS') {
      if (toDayStart(newStart) < toDayStart(minDate)) {
        return {
          valid: false,
          message: `La fecha de inicio no puede ser anterior al requisito de la dependencia (${p.dependencyType}${lag ? ` + ${lag} días` : ''}). Debe ser al menos ${minDate.toLocaleDateString('es-AR')}.`,
        }
      }
    } else {
      if (toDayStart(newEnd) < toDayStart(minDate)) {
        return {
          valid: false,
          message: `La fecha de fin no puede ser anterior al requisito de la dependencia (${p.dependencyType}${lag ? ` + ${lag} días` : ''}). Debe ser al menos ${minDate.toLocaleDateString('es-AR')}.`,
        }
      }
    }
  }

  for (const s of successors) {
    const sStart = new Date(s.plannedStartDate)
    const sEnd = new Date(s.plannedEndDate)
    const lag = s.lagDays
    const refDate =
      s.dependencyType === 'FS' || s.dependencyType === 'FF' ? newEnd : newStart
    const minDate = addWorkingDays(
      refDate,
      lag,
      workingDaysPerWeek
    )

    if (s.dependencyType === 'FS' || s.dependencyType === 'SS') {
      if (toDayStart(sStart) < toDayStart(minDate)) {
        return {
          valid: false,
          message: `La tarea sucesora no puede iniciar antes de lo que permite esta tarea (${s.dependencyType}${lag ? ` + ${lag} días` : ''}). La dependencia quedaría incumplida.`,
        }
      }
    } else {
      if (toDayStart(sEnd) < toDayStart(minDate)) {
        return {
          valid: false,
          message: `La tarea sucesora no puede terminar antes de lo que permite esta tarea (${s.dependencyType}${lag ? ` + ${lag} días` : ''}). La dependencia quedaría incumplida.`,
        }
      }
    }
  }

  return { valid: true }
}
