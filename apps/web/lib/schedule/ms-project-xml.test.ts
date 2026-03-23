import { describe, it, expect } from 'vitest'
import { buildMsProjectXml, escapeXml, parseMsProjectXml } from './ms-project-xml'

describe('ms-project-xml', () => {
  it('escapeXml escapes special characters', () => {
    expect(escapeXml('a & b < c > d "e"')).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot;'
    )
  })

  it('export then parse preserves outline and one dependency', () => {
    const start = new Date(2025, 0, 6, 8, 0, 0)
    const end = new Date(2025, 0, 8, 17, 0, 0)
    const xml = buildMsProjectXml({
      projectTitle: 'P',
      scheduleTitle: 'S',
      hoursPerDay: 8,
      workingDaysPerWeek: 5,
      projectStartDate: start,
      tasks: [
        {
          id: 'a',
          wbsCode: '1',
          wbsName: 'A',
          taskType: 'TASK',
          plannedStartDate: start,
          plannedEndDate: end,
          plannedDuration: 3,
          progressPercent: 0,
        },
        {
          id: 'b',
          wbsCode: '2',
          wbsName: 'B',
          taskType: 'TASK',
          plannedStartDate: end,
          plannedEndDate: new Date(2025, 0, 10, 17, 0, 0),
          plannedDuration: 2,
          progressPercent: 50,
        },
      ],
      dependencies: [
        {
          predecessorId: 'a',
          successorId: 'b',
          dependencyType: 'FS',
          lagDays: 0,
        },
      ],
    })

    const parsed = parseMsProjectXml(xml, 8)
    expect(parsed.tasks.length).toBe(2)
    const t1 = parsed.tasks.find((t) => t.outlineNumber === '1')
    const t2 = parsed.tasks.find((t) => t.outlineNumber === '2')
    expect(t1).toBeDefined()
    expect(t2?.predecessors.some((p) => p.predecessorUid === t1!.uid)).toBe(true)
  })
})
