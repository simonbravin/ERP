'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ExportDialog } from '@/components/export/export-dialog'
import { exportProjectsToExcel } from '@/app/actions/export'
import { FileDown } from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ProjectCard } from './project-card'
import { ProjectStatusBadge } from './project-status-badge'
import { ProjectPhaseBadge } from './project-phase-badge'
import { formatCurrency } from '@/lib/format-utils'
import { ArrowUpDown, Grid, List, Eye, FolderKanban } from 'lucide-react'
import { Link } from '@/i18n/navigation'

interface Project {
  id: string
  projectNumber: string
  name: string
  clientName: string | null
  phase: string
  status: string
  totalBudget?: number | { toNumber(): number } | null
  location?: string | null
  startDate: Date | null
  createdAt: Date
}

interface ProjectsListClientProps {
  projects: Project[]
  canEdit: boolean
  showExport?: boolean
}

/**
 * Projects list with TanStack Table, filtering, sorting, and view toggle
 */
export function ProjectsListClient({ projects, canEdit, showExport = false }: ProjectsListClientProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sorting, setSorting] = useState<SortingState>([])
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showExportDialog, setShowExportDialog] = useState(false)

  const exportColumns = [
    { field: 'projectNumber', label: t('projectNumber'), defaultVisible: true },
    { field: 'name', label: t('name'), defaultVisible: true },
    { field: 'clientName', label: t('client'), defaultVisible: true },
    { field: 'location', label: t('location'), defaultVisible: true },
    { field: 'phase', label: t('phase'), defaultVisible: true },
    { field: 'status', label: t('status'), defaultVisible: true },
    { field: 'createdAt', label: t('createdAt'), defaultVisible: false },
  ]

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[]) {
    if (format !== 'excel') {
      return { success: false, error: 'Solo exportación Excel disponible para proyectos' }
    }
    return await exportProjectsToExcel(selectedColumns)
  }

  // Search and filter states
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || 'all'
  )
  const [phaseFilter, setPhaseFilter] = useState(
    searchParams.get('phase') || 'all'
  )

  // Update URL when filters change
  const updateFilters = (
    newSearch: string,
    newStatus: string,
    newPhase: string
  ) => {
    const params = new URLSearchParams()
    if (newSearch) params.set('search', newSearch)
    if (newStatus !== 'all') params.set('status', newStatus)
    if (newPhase !== 'all') params.set('phase', newPhase)

    const queryString = params.toString()
    router.push(`${pathname}${queryString ? '?' + queryString : ''}`)
  }

  // Helper to get budget as number
  const getBudget = (project: Project): number => {
    if (!project.totalBudget) return 0
    if (typeof project.totalBudget === 'number') return project.totalBudget
    return project.totalBudget.toNumber()
  }

  // Columns definition
  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        accessorKey: 'projectNumber',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
              className="h-8 px-2"
            >
              {t('projectNumber')}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium text-slate-700">
            {row.getValue('projectNumber')}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
              className="h-8 px-2"
            >
              {t('name')}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <Link
            href={`/projects/${row.original.id}`}
            className="font-medium text-foreground hover:text-accent hover:underline"
          >
            {row.getValue('name')}
          </Link>
        ),
      },
      {
        accessorKey: 'clientName',
        header: () => t('client'),
        cell: ({ row }) => (
          <span className="text-slate-600">
            {row.getValue('clientName') || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'phase',
        header: () => t('phase'),
        cell: ({ row }) => <ProjectPhaseBadge phase={row.getValue('phase')} />,
      },
      {
        accessorKey: 'status',
        header: () => t('status'),
        cell: ({ row }) => (
          <ProjectStatusBadge status={row.getValue('status')} />
        ),
      },
      {
        id: 'totalBudget',
        accessorFn: (row) => getBudget(row),
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
              className="h-8 px-2"
            >
              {t('budget')}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(row.getValue('totalBudget'))}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => tCommon('actions'),
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${row.original.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              {tCommon('view')}
            </Link>
          </Button>
        ),
      },
    ],
    [t, tCommon]
  )

  // Filter projects locally
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesSearch =
          project.name.toLowerCase().includes(searchLower) ||
          project.projectNumber.toLowerCase().includes(searchLower) ||
          project.clientName?.toLowerCase().includes(searchLower)

        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false
      }

      // Phase filter
      if (phaseFilter !== 'all' && project.phase !== phaseFilter) {
        return false
      }

      return true
    })
  }, [projects, search, statusFilter, phaseFilter])

  // Table instance
  const table = useReactTable({
    data: filteredProjects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  return (
    <>
    <div className="w-full space-y-4">
      {showExport && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
            <FileDown className="mr-2 h-4 w-4" />
            {tCommon('export')} Lista
          </Button>
        </div>
      )}
      <div className="flex w-full flex-col gap-4">
        <div className="erp-search-row">
          <div className="erp-search-input-wrap">
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                updateFilters(e.target.value, statusFilter, phaseFilter)
              }}
              className="erp-search-input text-base"
            />
          </div>
        </div>

        {/* Fila 2: Filtro por estado */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t('status')}:</span>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              updateFilters(search, value, phaseFilter)
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={t('statusAll')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('statusAll')}</SelectItem>
              <SelectItem value="DRAFT">{t('statusDraft')}</SelectItem>
              <SelectItem value="ACTIVE">{t('statusActive')}</SelectItem>
              <SelectItem value="ON_HOLD">{t('statusOnHold')}</SelectItem>
              <SelectItem value="COMPLETED">{t('statusComplete')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fila 3: Filtro por fase */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{t('phase')}:</span>
          <Select
            value={phaseFilter}
            onValueChange={(value) => {
              setPhaseFilter(value)
              updateFilters(search, statusFilter, value)
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={t('phaseAll')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('phaseAll')}</SelectItem>
              <SelectItem value="PRE_CONSTRUCTION">
                {t('phasePreConstruction')}
              </SelectItem>
              <SelectItem value="CONSTRUCTION">
                {t('phaseConstruction')}
              </SelectItem>
              <SelectItem value="CLOSEOUT">{t('phaseCloseout')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fila 4: Vista tabla / cuadrícula */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Vista:</span>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 px-3"
              title="Vista de tabla"
            >
              <List className="mr-1.5 h-4 w-4" />
              Tabla
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 px-3"
              title="Vista de cuadrícula"
            >
              <Grid className="mr-1.5 h-4 w-4" />
              Cuadrícula
            </Button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {t('showing')} {filteredProjects.length} {t('of')} {projects.length}{' '}
        {t('projectsCount')}
      </p>

      {/* Table or Grid view */}
      {viewMode === 'table' ? (
        <div className="erp-table-wrap">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="erp-row-interactive cursor-pointer"
                    onClick={() => router.push(`/projects/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center py-8">
                      <FolderKanban className="h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t('noResults')}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">{t('noResults')}</p>
            </div>
          )}
        </div>
      )}
    </div>

    <ExportDialog
      open={showExportDialog}
      onOpenChange={setShowExportDialog}
      title={t('exportListTitle')}
      columns={exportColumns}
      onExport={handleExport}
    />
    </>
  )
}
