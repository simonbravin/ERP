import { getScheduleForView } from '@/app/actions/schedule'
import { getProjectMembers } from '@/app/actions/team'
import { ScheduleViewClient } from './schedule-view-client'

export type ScheduleAssignmentOption = { value: string; label: string }

function buildScheduleAssignmentOptions(
  members: Awaited<ReturnType<typeof getProjectMembers>>
): ScheduleAssignmentOption[] {
  const byValue = new Map<string, string>()
  for (const pm of members) {
    const u = pm.orgMember?.user
    if (!u) continue
    const name = (u.fullName ?? '').trim()
    const email = (u.email ?? '').trim()
    const value = name || email
    if (!value) continue
    const label = name
      ? email && email.toLowerCase() !== name.toLowerCase()
        ? `${name} (${email})`
        : name
      : email
    if (!byValue.has(value)) byValue.set(value, label)
  }
  return [...byValue.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

interface ScheduleViewProps {
  scheduleId: string
  canEdit: boolean
  canSetBaseline: boolean
  /** User can create a new schedule version (e.g. to get a DRAFT copy when viewing baseline). */
  canCreateVersion?: boolean
}

export async function ScheduleView({
  scheduleId,
  canEdit,
  canSetBaseline,
  canCreateVersion = false,
}: ScheduleViewProps) {
  const scheduleData = await getScheduleForView(scheduleId)

  if (!scheduleData) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            No se pudo cargar el cronograma
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Verifica que el cronograma existe y tienes permisos para verlo
          </p>
        </div>
      </div>
    )
  }

  let assignmentOptions: ScheduleAssignmentOption[] = []
  try {
    const members = await getProjectMembers(scheduleData.project.id)
    assignmentOptions = buildScheduleAssignmentOptions(members)
  } catch {
    assignmentOptions = []
  }

  return (
    <ScheduleViewClient
      scheduleData={scheduleData}
      canEdit={canEdit}
      canSetBaseline={canSetBaseline}
      canCreateVersion={canCreateVersion}
      assignmentOptions={assignmentOptions}
    />
  )
}
