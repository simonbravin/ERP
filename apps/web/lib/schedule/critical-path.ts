import { addWorkingDays, countWorkingDays, type WorkingDayOptions } from './working-days'

export interface TaskNode {
  id: string
  duration: number
  predecessors: Array<{
    id: string
    type: 'FS' | 'SS' | 'FF' | 'SF'
    lag: number
  }>
  successors: Array<{
    id: string
    type: 'FS' | 'SS' | 'FF' | 'SF'
    lag: number
  }>
}

export interface CalculatedTask {
  id: string
  earlyStart: Date
  earlyFinish: Date
  lateStart: Date
  lateFinish: Date
  totalFloat: number
  freeFloat: number
  isCritical: boolean
}

/**
 * Topological order: predecessors before successors (for forward pass).
 */
function topologicalSort(tasks: TaskNode[]): TaskNode[] {
  const visited = new Set<string>()
  const result: TaskNode[] = []

  function visit(task: TaskNode) {
    if (visited.has(task.id)) return
    visited.add(task.id)
    for (const pred of task.predecessors) {
      const predTask = tasks.find((t) => t.id === pred.id)
      if (predTask) visit(predTask)
    }
    result.push(task)
  }

  for (const task of tasks) {
    visit(task)
  }
  return result
}

/**
 * CPM (Critical Path Method): forward pass + backward pass.
 */
export function calculateCriticalPath(
  tasks: TaskNode[],
  projectStartDate: Date,
  workingDaysPerWeek: number = 6,
  calendarOptions?: WorkingDayOptions
): CalculatedTask[] {
  const calculated = new Map<string, CalculatedTask>()
  const sorted = topologicalSort(tasks)

  // Forward pass
  for (const task of sorted) {
    let earlyStart = new Date(projectStartDate)

    if (task.predecessors.length > 0) {
      let maxFinish = new Date(projectStartDate)

      for (const pred of task.predecessors) {
        const predCalc = calculated.get(pred.id)
        if (!predCalc) continue

        let dependentDate: Date
        switch (pred.type) {
          case 'FS':
            dependentDate = predCalc.earlyFinish
            break
          case 'SS':
            dependentDate = predCalc.earlyStart
            break
          case 'FF':
            dependentDate = addWorkingDays(
              predCalc.earlyFinish,
              -task.duration,
              workingDaysPerWeek,
              calendarOptions
            )
            break
          case 'SF':
            dependentDate = addWorkingDays(
              predCalc.earlyStart,
              -task.duration,
              workingDaysPerWeek,
              calendarOptions
            )
            break
          default:
            dependentDate = predCalc.earlyFinish
        }

        dependentDate = addWorkingDays(
          dependentDate,
          pred.lag,
          workingDaysPerWeek,
          calendarOptions
        )
        if (dependentDate > maxFinish) maxFinish = dependentDate
      }
      earlyStart = maxFinish
    }

    const earlyFinish = addWorkingDays(
      earlyStart,
      task.duration,
      workingDaysPerWeek,
      calendarOptions
    )

    calculated.set(task.id, {
      id: task.id,
      earlyStart,
      earlyFinish,
      lateStart: earlyStart,
      lateFinish: earlyFinish,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: false,
    })
  }

  const projectEndDate = Array.from(calculated.values()).reduce(
    (max, task) => (task.earlyFinish > max ? task.earlyFinish : max),
    projectStartDate
  )

  // Backward pass
  for (let i = sorted.length - 1; i >= 0; i--) {
    const task = sorted[i]
    const calc = calculated.get(task.id)!
    let lateFinish = new Date(projectEndDate)

    if (task.successors.length > 0) {
      let minStart = new Date(projectEndDate)

      for (const succ of task.successors) {
        const succCalc = calculated.get(succ.id)
        if (!succCalc) continue

        let dependentDate: Date
        switch (succ.type) {
          case 'FS':
            dependentDate = succCalc.lateStart
            break
          case 'SS':
            dependentDate = addWorkingDays(
              succCalc.lateStart,
              task.duration,
              workingDaysPerWeek,
              calendarOptions
            )
            break
          case 'FF':
            dependentDate = succCalc.lateFinish
            break
          case 'SF':
            dependentDate = addWorkingDays(
              succCalc.lateFinish,
              task.duration,
              workingDaysPerWeek,
              calendarOptions
            )
            break
          default:
            dependentDate = succCalc.lateStart
        }

        dependentDate = addWorkingDays(
          dependentDate,
          -succ.lag,
          workingDaysPerWeek,
          calendarOptions
        )
        if (dependentDate < minStart) minStart = dependentDate
      }
      lateFinish = minStart
    }

    const lateStart = addWorkingDays(
      lateFinish,
      -task.duration,
      workingDaysPerWeek,
      calendarOptions
    )

    const totalFloat = countWorkingDays(
      calc.earlyStart,
      lateStart,
      workingDaysPerWeek,
      calendarOptions
    )

    let freeFloat = totalFloat
    if (task.successors.length > 0) {
      const earliestSuccessorES = task.successors.reduce((min, succ) => {
        const succCalc = calculated.get(succ.id)
        if (!succCalc) return min
        return succCalc.earlyStart < min ? succCalc.earlyStart : min
      }, new Date(projectEndDate))
      freeFloat = countWorkingDays(
        calc.earlyFinish,
        earliestSuccessorES,
        workingDaysPerWeek,
        calendarOptions
      )
    }

    calc.lateStart = lateStart
    calc.lateFinish = lateFinish
    calc.totalFloat = totalFloat
    calc.freeFloat = Math.max(0, freeFloat)
    calc.isCritical = totalFloat <= 0
  }

  return Array.from(calculated.values())
}
