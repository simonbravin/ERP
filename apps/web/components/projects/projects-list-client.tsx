'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { exportProjectsToExcel } from '@/app/actions/export'

const ExportDialog = dynamic(
  () => import('@/components/export/export-dialog').then((m) => ({ default: m.ExportDialog })),
  { ssr: false }
)
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
import { ListFiltersBar } from '@/components/list'
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
  /** When provided, list is server-paginated; show pagination controls and do not filter locally. */
  total?: number
  page?: number
  pageSize?: number
  searchParams?: { status?: string; phase?: string; search?: string; page?: string }
}

/**
 * Projects list with TanStack Table, filtering, sorting, and view toggle
 */
export function ProjectsListClient({ projects, canEdit: _canEdit, showExport = false, total: totalFromServer, page: pageFromServer = 1, pageSize: pageSizeFromServer, searchParams: _searchParamsFromPage }: ProjectsListClientProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPaginated = totalFromServer != null && pageFromServer != null && pageSizeFromServer != null

  const [sorting, setSorting] = useState<SortingState>([])
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
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

  // Build query string for navigation (filters + optional page)
  const buildQuery = (opts: { search?: string; status?: string; phase?: string; page?: number }) => {
    const p = new URLSearchParams()
    if (opts.search) p.set('search', opts.search)
    if (opts.status && opts.status !== 'all') p.set('status', opts.status)
    if (opts.phase && opts.phase !== 'all') p.set('phase', opts.phase)
    if (opts.page != null && opts.page > 1) p.set('page', String(opts.page))
    return p.toString()
  }

  // Update URL when filters change (reset to page 1 when paginated)
  const updateFilters = (
    newSearch: string,
    newStatus: string,
    newPhase: string
  ) => {
    const queryString = buildQuery({
      search: newSearch,
      status: newStatus,
      phase: newPhase,
      page: isPaginated ? 1 : undefined,
    })
    router.push(`${pathname}${queryString ? '?' + queryString : ''}`)
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setPhaseFilter('all')
    updateFilters('', 'all', 'all')
  }

  const goToPage = (newPage: number) => {
    const queryString = buildQuery({
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || 'all',
      phase: searchParams.get('phase') || 'all',
      page: newPage > 1 ? newPage : undefined,
    })
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

  // When server-paginated, server already applied filters; otherwise filter locally
  const filteredProjects = useMemo(() => {
    if (isPaginated) return projects
    return projects.filter((project) => {
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesSearch =
          project.name.toLowerCase().includes(searchLower) ||
          project.projectNumber.toLowerCase().includes(searchLower) ||
          project.clientName?.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }
      if (statusFilter !== 'all' && project.status !== statusFilter) return false
      if (phaseFilter !== 'all' && project.phase !== phaseFilter) return false
      return true
    })
  }, [projects, search, statusFilter, phaseFilter, isPaginated])

  const listData = filteredProjects

  // Table instance
  const table = useReactTable({
    data: listData,
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
      {/* Fila 1: Buscadora + Exportar Lista en la misma línea */}
      <div className="flex w-full flex-wrap items-center gap-3">
        <div className="erp-search-row flex-1 min-w-0">
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
        {showExport && (
          <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)} className="shrink-0">
            <FileDown className="mr-2 h-4 w-4" />
            {tCommon('export')}
          </Button>
        )}
      </div>

      {/* Fila 2: Filtros (Estado + Fase) + Vista */}
      <div className="flex flex-wrap items-center gap-4">
        <ListFiltersBar
          onClear={clearFilters}
          className="flex-1 min-w-0"
        >
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
        </ListFiltersBar>
        <div className="flex items-center gap-2">
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

      {/* Results count and pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {isPaginated && totalFromServer != null
            ? totalFromServer === 0
              ? `${t('showing')} 0 ${t('of')} 0 ${t('projectsCount')}`
              : `${t('showing')} ${Math.min((pageFromServer - 1) * pageSizeFromServer + 1, totalFromServer)}–${Math.min(pageFromServer * pageSizeFromServer, totalFromServer)} ${t('of')} ${totalFromServer} ${t('projectsCount')}`
            : `${t('showing')} ${listData.length} ${t('of')} ${projects.length} ${t('projectsCount')}`}
        </p>
        {isPaginated && totalFromServer != null && totalFromServer > pageSizeFromServer && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageFromServer <= 1}
              onClick={() => goToPage(pageFromServer - 1)}
            >
              {tCommon('previous', { defaultMessage: 'Anterior' })}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('page', { defaultMessage: 'Página' })} {pageFromServer} {t('of', { defaultMessage: 'de' })} {Math.ceil(totalFromServer / pageSizeFromServer)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pageFromServer * pageSizeFromServer >= totalFromServer}
              onClick={() => goToPage(pageFromServer + 1)}
            >
              {tCommon('next', { defaultMessage: 'Siguiente' })}
            </Button>
          </div>
        )}
      </div>

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
          {listData.length > 0 ? (
            listData.map((project) => (
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
