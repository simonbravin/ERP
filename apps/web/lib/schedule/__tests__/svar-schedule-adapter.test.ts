import { describe, expect, it } from 'vitest'
import {
  bloqerDependencyTypeToSvar,
  scheduleTasksToSvar,
  type ScheduleViewTaskLike,
} from '../svar-schedule-adapter'
import { parseSchedulePlanDate } from '../svar-gantt-scales'

describe('bloqerDependencyTypeToSvar', () => {
  it('maps FS/SS/FF/SF to SVAR link anchors', () => {
    expect(bloqerDependencyTypeToSvar('FS')).toBe('e2s')
    expect(bloqerDependencyTypeToSvar('SS')).toBe('s2s')
    expect(bloqerDependencyTypeToSvar('FF')).toBe('e2e')
    expect(bloqerDependencyTypeToSvar('SF')).toBe('s2e')
  })
})

describe('scheduleTasksToSvar', () => {
  const base = (over: Partial<ScheduleViewTaskLike>): ScheduleViewTaskLike => ({
    id: 't1',
    wbsNodeId: 'w1',
    taskType: 'TASK',
    plannedStartDate: '2025-01-10T00:00:00.000Z',
    plannedEndDate: '2025-01-20T00:00:00.000Z',
    plannedDuration: 5,
    progressPercent: 40,
    isCritical: false,
    wbsNode: { id: 'w1', code: '1', name: 'A', parentId: null },
    successors: [],
    ...over,
  })

  it('builds parent from WBS parentId when both tasks exist', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({ id: 'p', wbsNodeId: 'wp', wbsNode: { id: 'wp', code: '1', name: 'P', parentId: null } }),
      base({
        id: 'c',
        wbsNodeId: 'wc',
        wbsNode: { id: 'wc', code: '1.1', name: 'C', parentId: 'wp' },
      }),
    ]
    const { tasks: out } = scheduleTasksToSvar(tasks)
    expect(out.find((x) => x.id === 'c')?.parent).toBe('p')
    expect(out.find((x) => x.id === 'p')?.parent).toBeUndefined()
  })

  it('filters by visibleTaskIds', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({ id: 'a', wbsNodeId: 'wa', wbsNode: { id: 'wa', code: '1', name: 'A', parentId: null } }),
      base({
        id: 'b',
        wbsNodeId: 'wb',
        wbsNode: { id: 'wb', code: '2', name: 'B', parentId: null },
      }),
    ]
    const { tasks: out } = scheduleTasksToSvar(tasks, {
      visibleTaskIds: new Set(['a']),
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('sets base_start/base_end from baselinePlanByWbsNodeId when showBaseline', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({
        wbsNodeId: 'w1',
        wbsNode: { id: 'w1', code: '1', name: 'A', parentId: null },
      }),
    ]
    const { tasks: out } = scheduleTasksToSvar(tasks, {
      showBaseline: true,
      baselinePlanByWbsNodeId: {
        w1: {
          plannedStartDate: '2025-01-01T00:00:00.000Z',
          plannedEndDate: '2025-01-05T00:00:00.000Z',
        },
      },
    })
    expect(out[0].base_start).toEqual(
      parseSchedulePlanDate('2025-01-01T00:00:00.000Z')
    )
    expect(out[0].base_end).toEqual(
      parseSchedulePlanDate('2025-01-05T00:00:00.000Z')
    )
  })

  it('omits baseline fields when showBaseline is false', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({
        wbsNodeId: 'w1',
        wbsNode: { id: 'w1', code: '1', name: 'A', parentId: null },
      }),
    ]
    const { tasks: out } = scheduleTasksToSvar(tasks, {
      showBaseline: false,
      baselinePlanByWbsNodeId: {
        w1: {
          plannedStartDate: '2025-01-01T00:00:00.000Z',
          plannedEndDate: '2025-01-05T00:00:00.000Z',
        },
      },
    })
    expect(out[0].base_start).toBeUndefined()
    expect(out[0].base_end).toBeUndefined()
  })

  it('sets open false for leaf tasks (SVAR store crashes if open true with null data)', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({
        wbsNodeId: 'w1',
        wbsNode: { id: 'w1', code: '1', name: 'Leaf', parentId: null },
      }),
    ]
    const { tasks: out } = scheduleTasksToSvar(tasks)
    expect(out[0].open).toBe(false)
  })

  it('sets open true only for SUMMARY rows that have a visible child in the list', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({
        id: 'parent',
        wbsNodeId: 'wp',
        taskType: 'SUMMARY',
        wbsNode: { id: 'wp', code: '1', name: 'P', parentId: null },
      }),
      base({
        id: 'child',
        wbsNodeId: 'wc',
        wbsNode: { id: 'wc', code: '1.1', name: 'C', parentId: 'wp' },
      }),
    ]
    const { tasks: out } = scheduleTasksToSvar(tasks)
    expect(out.find((x) => x.id === 'parent')?.open).toBe(true)
    expect(out.find((x) => x.id === 'child')?.open).toBe(false)
  })

  it('sets open false for SUMMARY when children are filtered out by visibleTaskIds', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({
        id: 'parent',
        wbsNodeId: 'wp',
        taskType: 'SUMMARY',
        wbsNode: { id: 'wp', code: '1', name: 'P', parentId: null },
      }),
      base({
        id: 'child',
        wbsNodeId: 'wc',
        wbsNode: { id: 'wc', code: '1.1', name: 'C', parentId: 'wp' },
      }),
    ]
    const { tasks: out } = scheduleTasksToSvar(tasks, {
      visibleTaskIds: new Set(['parent']),
    })
    expect(out).toHaveLength(1)
    expect(out[0].open).toBe(false)
  })

  it('emits links from successors with correct SVAR type', () => {
    const tasks: ScheduleViewTaskLike[] = [
      base({
        id: 'pred',
        wbsNodeId: 'wp',
        wbsNode: { id: 'wp', code: '1', name: 'P', parentId: null },
        successors: [
          {
            id: 'dep1',
            predecessorId: 'pred',
            successorId: 'succ',
            dependencyType: 'FS',
            lagDays: 2,
          },
        ],
      }),
      base({
        id: 'succ',
        wbsNodeId: 'ws',
        wbsNode: { id: 'ws', code: '2', name: 'S', parentId: null },
      }),
    ]
    const { links } = scheduleTasksToSvar(tasks)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      id: 'dep1',
      type: 'e2s',
      source: 'pred',
      target: 'succ',
      lag: 2,
    })
  })
})
