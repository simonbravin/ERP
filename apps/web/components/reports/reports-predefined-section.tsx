'use client'

import { useRouter, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Link } from '@/i18n/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PredefinedReportItem = {
  id: string
  name: string
  description: string
  category: string
  icon: string
}

export type ProjectOption = {
  id: string
  name: string
  projectNumber?: string | null
}

type Props = {
  predefinedReports: PredefinedReportItem[]
  projects: ProjectOption[]
}

export function ReportsPredefinedSection({ predefinedReports, projects }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const projectIdsParam = searchParams.get('projectIds') ?? ''
  const selectedIds = projectIdsParam ? projectIdsParam.split(',').map((id) => id.trim()).filter(Boolean) : []

  const projectIdsQuery =
    selectedIds.length > 0 ? `?projectIds=${selectedIds.join(',')}` : ''

  const setProjectIds = useCallback(
    (ids: string[]) => {
      const next = new URLSearchParams(searchParams.toString())
      if (ids.length === 0) {
        next.delete('projectIds')
      } else {
        next.set('projectIds', ids.join(','))
      }
      const qs = next.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname)
      })
    },
    [pathname, router, searchParams]
  )

  const toggleProject = (id: string) => {
    if (selectedIds.includes(id)) {
      setProjectIds(selectedIds.filter((x) => x !== id))
    } else {
      setProjectIds([...selectedIds, id])
    }
  }

  const selectAll = () => setProjectIds([])
  const label =
    selectedIds.length === 0
      ? 'Todos los proyectos'
      : selectedIds.length === 1
        ? projects.find((p) => p.id === selectedIds[0])?.name ?? '1 proyecto'
        : `${selectedIds.length} proyectos`

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Datos de:
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[200px] justify-between"
              disabled={isPending}
            >
              <FolderKanban className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
            <DropdownMenuCheckboxItem
              checked={selectedIds.length === 0}
              onCheckedChange={(checked) => checked && selectAll()}
            >
              Todos los proyectos
            </DropdownMenuCheckboxItem>
            {projects.map((project) => (
              <DropdownMenuCheckboxItem
                key={project.id}
              checked={selectedIds.includes(project.id)}
              onCheckedChange={() => toggleProject(project.id)}
              >
                {project.name}
                {project.projectNumber && (
                  <span className="ml-1 text-muted-foreground">
                    ({project.projectNumber})
                  </span>
                )}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {predefinedReports.map((report) => (
          <Link
            key={report.id}
            href={`/reports/predefined/${report.id}${projectIdsQuery}`}
            className={cn(
              'group rounded-lg border border-border bg-card p-4 transition-all hover:border-accent hover:shadow-md'
            )}
          >
            <div className="mb-3 text-3xl">{report.icon}</div>
            <h3 className="font-semibold text-foreground group-hover:text-accent">
              {report.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
