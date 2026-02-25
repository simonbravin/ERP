import { notFound } from 'next/navigation'
import { getScheduleForView } from '@/app/actions/schedule'
import { PrintTable } from '@/components/print/print-table'

type PageProps = {
  params: Promise<{ scheduleId: string }>
}

type TaskRow = {
  code: string
  name: string
  startDate: string
  endDate: string
  duration: number
  progress: string
}

export default async function PrintSchedulePage({ params }: PageProps) {
  const { scheduleId } = await params

  const schedule = await getScheduleForView(scheduleId)

  if (!schedule) return notFound()

  const project = schedule.project as { name?: string; projectNumber?: string } | null
  const tasks = (schedule.tasks ?? []) as Array<{
    wbsNode?: { code?: string; name?: string } | null
    plannedStartDate?: string
    plannedEndDate?: string
    plannedDuration?: number
    progressPercent?: number
  }>

  const rows: TaskRow[] = tasks.map((task) => ({
    code: task.wbsNode?.code ?? '—',
    name: task.wbsNode?.name ?? '—',
    startDate: task.plannedStartDate
      ? new Date(task.plannedStartDate).toLocaleDateString('es-AR', { dateStyle: 'short' })
      : '—',
    endDate: task.plannedEndDate
      ? new Date(task.plannedEndDate).toLocaleDateString('es-AR', { dateStyle: 'short' })
      : '—',
    duration: task.plannedDuration ?? 0,
    progress: typeof task.progressPercent === 'number' ? `${task.progressPercent}%` : '0%',
  }))

  const columns = [
    { key: 'code' as const, label: 'Código', align: 'left' as const },
    { key: 'name' as const, label: 'Actividad', align: 'left' as const },
    { key: 'startDate' as const, label: 'Inicio', align: 'left' as const },
    { key: 'endDate' as const, label: 'Fin', align: 'left' as const },
    { key: 'duration' as const, label: 'Duración (días)', align: 'right' as const },
    { key: 'progress' as const, label: 'Avance %', align: 'center' as const },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Cronograma — {project?.name ?? 'Proyecto'}
        {project?.projectNumber ? ` (${project.projectNumber})` : ''}
      </h2>
      <PrintTable<TaskRow> columns={columns} rows={rows} />
    </div>
  )
}
