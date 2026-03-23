import { XMLParser } from 'fast-xml-parser'

/** MS Project XML: PredecessorLink Type (PJTaskLink). */
export const MS_LINK_TYPE = {
  FF: 0,
  FS: 1,
  SS: 2,
  SF: 3,
} as const

const MS_LINK_TYPE_REVERSE: Record<number, 'FF' | 'FS' | 'SS' | 'SF'> = {
  0: 'FF',
  1: 'FS',
  2: 'SS',
  3: 'SF',
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function compareWbsCode(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na - nb
  }
  return 0
}

function formatMsDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}:${s}`
}

function durationToPtHours(workingDays: number, hoursPerDay: number): string {
  const h = Math.max(0, Math.round(workingDays * hoursPerDay))
  return `PT${h}H0M0S`
}

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return []
  return Array.isArray(x) ? x : [x]
}

export type MsProjectExportTask = {
  id: string
  wbsCode: string
  wbsName: string
  taskType: string
  plannedStartDate: Date
  plannedEndDate: Date
  plannedDuration: number
  progressPercent: number
}

export type MsProjectExportDep = {
  predecessorId: string
  successorId: string
  dependencyType: string
  lagDays: number
}

export function buildMsProjectXml(input: {
  projectTitle: string
  scheduleTitle: string
  hoursPerDay: number
  workingDaysPerWeek: number
  projectStartDate: Date
  tasks: MsProjectExportTask[]
  dependencies: MsProjectExportDep[]
}): string {
  const sorted = [...input.tasks].sort((a, b) =>
    compareWbsCode(a.wbsCode, b.wbsCode)
  )
  const idToUid = new Map<string, number>()
  sorted.forEach((t, i) => idToUid.set(t.id, i + 1))

  const depXmlBySuccessor = new Map<string, MsProjectExportDep[]>()
  for (const d of input.dependencies) {
    const list = depXmlBySuccessor.get(d.successorId) ?? []
    list.push(d)
    depXmlBySuccessor.set(d.successorId, list)
  }

  const taskBlocks = sorted.map((t, idx) => {
    const uid = idx + 1
    const level = t.wbsCode.split('.').length
    const isSummary = t.taskType === 'SUMMARY'
    const isMilestone = t.taskType === 'MILESTONE'
    const name = escapeXml(`${t.wbsCode} — ${t.wbsName}`)
    const deps = depXmlBySuccessor.get(t.id) ?? []
    const predLinks = deps
      .map((d) => {
        const predUid = idToUid.get(d.predecessorId)
        if (!predUid) return ''
        const type =
          d.dependencyType === 'FS'
            ? MS_LINK_TYPE.FS
            : d.dependencyType === 'SS'
              ? MS_LINK_TYPE.SS
              : d.dependencyType === 'FF'
                ? MS_LINK_TYPE.FF
                : d.dependencyType === 'SF'
                  ? MS_LINK_TYPE.SF
                  : MS_LINK_TYPE.FS
        const linkLag = Math.round(
          d.lagDays * input.hoursPerDay * 60 * 10
        )
        return `      <PredecessorLink>
        <PredecessorUID>${predUid}</PredecessorUID>
        <Type>${type}</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>${linkLag}</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>`
      })
      .filter(Boolean)
      .join('\n')

    const durationXml = isMilestone
      ? `      <Duration>PT0H0M0S</Duration>
      <DurationFormat>53</DurationFormat>`
      : `      <Duration>${durationToPtHours(t.plannedDuration, input.hoursPerDay)}</Duration>
      <DurationFormat>21</DurationFormat>`

    return `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <Name>${name}</Name>
      <Active>1</Active>
      <Manual>0</Manual>
      <Type>0</Type>
      <IsNull>0</IsNull>
      <OutlineNumber>${escapeXml(t.wbsCode)}</OutlineNumber>
      <OutlineLevel>${level}</OutlineLevel>
      <Priority>500</Priority>
      <Start>${formatMsDate(t.plannedStartDate)}</Start>
      <Finish>${formatMsDate(t.plannedEndDate)}</Finish>
      <PercentComplete>${Math.round(Math.min(100, Math.max(0, t.progressPercent)))}</PercentComplete>
      <Summary>${isSummary ? 1 : 0}</Summary>
      <Milestone>${isMilestone ? 1 : 0}</Milestone>
${durationXml}
${predLinks ? `${predLinks}\n` : ''}    </Task>`
  })

  const title = escapeXml(`${input.projectTitle} — ${input.scheduleTitle}`)
  const weekMinutes = input.workingDaysPerWeek * input.hoursPerDay * 60

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${title}</Name>
  <Title>${title}</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${formatMsDate(input.projectStartDate)}</StartDate>
  <MinutesPerDay>${input.hoursPerDay * 60}</MinutesPerDay>
  <MinutesPerWeek>${weekMinutes}</MinutesPerWeek>
  <Tasks>
${taskBlocks.join('\n')}
  </Tasks>
</Project>`
}

export type ParsedMsProjectRow = {
  uid: number
  outlineNumber: string
  name: string
  start: Date | null
  finish: Date | null
  isSummary: boolean
  isMilestone: boolean
  predecessors: Array<{
    predecessorUid: number
    type: 'FF' | 'FS' | 'SS' | 'SF'
    lagDays: number
  }>
}

function parseMsDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Lag en décimas de minuto → días laborables aproximados (misma convención que export). */
function linkLagToLagDays(linkLag: number, hoursPerDay: number): number {
  if (linkLag === 0 || hoursPerDay <= 0) return 0
  const minutes = linkLag / 10
  return minutes / (hoursPerDay * 60)
}

export function parseMsProjectXml(
  xml: string,
  hoursPerDay: number
): { title: string | null; tasks: ParsedMsProjectRow[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
  })
  const doc = parser.parse(xml)
  const project = doc.Project ?? doc.project
  if (!project) {
    throw new Error('INVALID_XML_NO_PROJECT')
  }

  const title =
    project.Name != null && String(project.Name).trim()
      ? String(project.Name).trim()
      : project.Title != null && String(project.Title).trim()
        ? String(project.Title).trim()
        : null

  const rawTasks = asArray(project.Tasks?.Task)
  const rows: ParsedMsProjectRow[] = []

  for (const rt of rawTasks) {
    if (!rt || typeof rt !== 'object') continue
    const uid = Number(rt.UID)
    if (!Number.isFinite(uid)) continue

    const outlineNumber = String(rt.OutlineNumber ?? '')
      .trim()
      .replace(/\s+/g, '')
    if (!outlineNumber) continue

    const name = String(rt.Name ?? '').trim()
    const start = parseMsDate(rt.Start)
    const finish = parseMsDate(rt.Finish)
    const isSummary = Number(rt.Summary) === 1 || String(rt.Summary) === 'true'
    const isMilestone = Number(rt.Milestone) === 1 || String(rt.Milestone) === 'true'

    const preds: ParsedMsProjectRow['predecessors'] = []
    const rawPreds = asArray(rt.PredecessorLink)
    for (const pl of rawPreds) {
      if (!pl || typeof pl !== 'object') continue
      const pUid = Number(pl.PredecessorUID)
      if (!Number.isFinite(pUid)) continue
      const typeNum = Number(pl.Type)
      const depType = MS_LINK_TYPE_REVERSE[typeNum] ?? 'FS'
      const linkLag = Number(pl.LinkLag) || 0
      const lagDays = linkLagToLagDays(linkLag, hoursPerDay)
      preds.push({ predecessorUid: pUid, type: depType, lagDays })
    }

    rows.push({
      uid,
      outlineNumber,
      name,
      start,
      finish,
      isSummary,
      isMilestone,
      predecessors: preds,
    })
  }

  return { title, tasks: rows }
}
