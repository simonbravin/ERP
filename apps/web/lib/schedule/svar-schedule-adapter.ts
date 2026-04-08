import type { ILink, ITask } from '@svar-ui/react-gantt'

import { parseSchedulePlanDate } from './svar-gantt-scales'

/** SVAR link anchor → tipo de dependencia Bloqer / MS Project. */
export function svarLinkTypeToBloqer(
  t: ILink['type']
): 'FS' | 'SS' | 'FF' | 'SF' {
  switch (t) {
    case 'e2s':
      return 'FS'
    case 's2s':
      return 'SS'
    case 'e2e':
      return 'FF'
    case 's2e':
      return 'SF'
    default:
      return 'FS'
  }
}

/** Bloqer dependency type → SVAR link anchor type (start/end of predecessor/successor). */
export function bloqerDependencyTypeToSvar(
  t: 'FS' | 'SS' | 'FF' | 'SF'
): ILink['type'] {
  switch (t) {
    case 'FS':
      return 'e2s'
    case 'SS':
      return 's2s'
    case 'FF':
      return 'e2e'
    case 'SF':
      return 's2e'
    default:
      return 'e2s'
  }
}

export type ScheduleViewTaskLike = {
  id: string
  wbsNodeId: string
  taskType: string
  plannedStartDate: string
  plannedEndDate: string
  plannedDuration: number
  progressPercent: number
  isCritical: boolean
  wbsNode: {
    id: string
    code: string
    name: string
    parentId: string | null
  }
  successors?: Array<{
    id: string
    predecessorId: string
    successorId: string
    dependencyType: string
    lagDays: number
  }>
}

/**
 * Maps serialized `getScheduleForView` tasks + optional visibility filter to SVAR `tasks` + `links`.
 * Server remains source of truth; this is presentation-only (phase 0 PoC).
 */
export function scheduleTasksToSvar(
  tasks: ScheduleViewTaskLike[],
  options?: {
    visibleTaskIds?: Set<string>
  }
): { tasks: ITask[]; links: ILink[] } {
  const source = Array.isArray(tasks) ? tasks : []
  const visible = options?.visibleTaskIds
  const list = visible ? source.filter((t) => visible.has(t.id)) : [...source]

  const wbsToTaskId = new Map<string, string>()
  for (const t of list) {
    wbsToTaskId.set(t.wbsNodeId, t.id)
  }

  /** WBS nodes that appear as parent of at least one task in the current list (visible set). */
  const wbsIdsWithChildren = new Set<string>()
  for (const t of list) {
    const pid = t.wbsNode.parentId
    if (pid != null) wbsIdsWithChildren.add(pid)
  }

  const svarTasks: ITask[] = list.map((t) => {
    const parentWbsId = t.wbsNode.parentId
    const parentTaskId =
      parentWbsId != null ? wbsToTaskId.get(parentWbsId) : undefined

    const type = (t.taskType || 'TASK').toLowerCase() as ITask['type']
    /**
     * SVAR `toArray()` recurses with `n.open && Ct(n.data)`. Leaf nodes keep `data: null` after parse;
     * `open: true` on a leaf causes `null.forEach` → crash. Only summaries with visible children may open.
     */
    const open =
      type === 'summary' && wbsIdsWithChildren.has(t.wbsNode.id)

    const row: ITask = {
      id: t.id,
      text: `${t.wbsNode.code} ${t.wbsNode.name}`.trim(),
      start: parseSchedulePlanDate(t.plannedStartDate),
      end: parseSchedulePlanDate(t.plannedEndDate),
      duration: t.plannedDuration,
      progress: Number(t.progressPercent),
      type,
      open,
      critical: t.isCritical,
    }
    if (parentTaskId) {
      row.parent = parentTaskId
    }
    return row
  })

  const linkById = new Map<string, ILink>()
  const taskIdSet = new Set(list.map((x) => x.id))

  for (const t of list) {
    const succs = t.successors ?? []
    for (const d of succs) {
      if (!taskIdSet.has(d.predecessorId) || !taskIdSet.has(d.successorId)) {
        continue
      }
      const depType = d.dependencyType as 'FS' | 'SS' | 'FF' | 'SF'
      linkById.set(d.id, {
        id: d.id,
        type: bloqerDependencyTypeToSvar(depType),
        source: d.predecessorId,
        target: d.successorId,
        lag: d.lagDays ?? 0,
      })
    }
  }

  return { tasks: svarTasks, links: [...linkById.values()] }
}
