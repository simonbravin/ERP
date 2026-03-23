'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Play, Save, Calendar } from 'lucide-react'
import { getAvailableTables, executeCustomQuery, getProjectsForQueryBuilder } from '@/app/actions/reports'
import type { TableMetadata, QueryConfig, QueryFilter, QueryField } from '@/lib/types/reports'
import { toast } from 'sonner'

const DATE_KEYS = ['startDate', 'plannedEndDate', 'issueDate', 'actualEndDate', 'issuedDate', 'movementDate']
const AMOUNT_KEYS = ['totalBudget', 'gastadoHastaElMomento', 'montoAvance', 'diferencia', 'total', 'amountBaseCurrency', 'directCostTotal']
const PCT_KEYS = ['avanceObraPct']

function formatShortDate(val: unknown): string {
  if (val == null) return '—'
  const d = typeof val === 'string' ? new Date(val) : val instanceof Date ? val : null
  if (!d || Number.isNaN(d.getTime())) return String(val)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function formatPreviewCell(key: string, val: unknown): string {
  if (val == null) return '—'
  if (PCT_KEYS.includes(key) && typeof val === 'number') return `${val.toFixed(2)} %`
  if (AMOUNT_KEYS.includes(key) && typeof val === 'number')
    return new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  if (DATE_KEYS.includes(key)) return formatShortDate(val)
  return String(val)
}

function QueryBuilderPreview({
  data,
  selectedFields,
  fields,
}: {
  data: Record<string, unknown>[]
  selectedFields: string[]
  fields: QueryField[]
}) {
  const t = useTranslations('reports')
  const columns = selectedFields.length > 0
    ? selectedFields.filter((k) => data[0] && k in data[0])
    : data[0]
      ? Object.keys(data[0])
      : []
  const getLabel = (key: string) => fields.find((f) => f.field === key)?.label ?? key

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('queryPreviewTitle', { count: data.length })}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((key) => (
                  <TableHead key={key}>{getLabel(key)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 50).map((row, idx) => (
                <TableRow key={idx}>
                  {columns.map((key) => (
                    <TableCell key={key}>{formatPreviewCell(key, row[key])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

type ProjectOption = { id: string; name: string; projectNumber: string }

export function QueryBuilder() {
  const t = useTranslations('reports')
  const operators = useMemo(
    (): { value: QueryFilter['operator']; label: string }[] => [
      { value: '=', label: '=' },
      { value: '!=', label: '!=' },
      { value: '>', label: '>' },
      { value: '<', label: '<' },
      { value: '>=', label: '>=' },
      { value: '<=', label: '<=' },
      { value: 'CONTAINS', label: t('operatorContains') },
    ],
    [t]
  )
  const [tables, setTables] = useState<TableMetadata[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedTable, setSelectedTable] = useState('')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [filters, setFilters] = useState<QueryFilter[]>([])
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [projectFilter, setProjectFilter] = useState<'all' | 'selected'>('all')
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    getAvailableTables().then(setTables)
  }, [])
  useEffect(() => {
    getProjectsForQueryBuilder().then(setProjects)
  }, [])

  const currentTable = tables.find((t) => t.name === selectedTable)
  const availableFields = currentTable?.fields ?? []

  const handleAddFilter = () => {
    setFilters([
      ...filters,
      {
        id: crypto.randomUUID(),
        field: '',
        operator: '=',
        value: '',
      },
    ])
  }

  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id))
  }

  const handleRunQuery = async () => {
    if (!selectedTable || selectedFields.length === 0) {
      toast.error(t('toast.queryNeedTableAndFields'))
      return
    }
    setIsLoading(true)
    try {
      const config: QueryConfig = {
        table: selectedTable,
        select: selectedFields,
        where: filters.filter((f) => f.field && f.value !== undefined && String(f.value).trim() !== ''),
        ...(projectFilter === 'selected' && selectedProjectIds.size > 0
          ? { projectIds: Array.from(selectedProjectIds) }
          : {}),
        ...(dateFrom ? { dateFrom: dateFrom.slice(0, 10) } : {}),
        ...(dateTo ? { dateTo: dateTo.slice(0, 10) } : {}),
      }
      const result = await executeCustomQuery(config)
      setPreviewData(result.data)
      toast.success(t('toast.querySuccess', { count: result.totalRows, ms: result.executionTime }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.queryExecuteError'))
    } finally {
      setIsLoading(false)
    }
  }

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllProjects = () => {
    setSelectedProjectIds(new Set(projects.map((p) => p.id)))
  }
  const clearAllProjects = () => {
    setSelectedProjectIds(new Set())
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Seleccionar Tabla Base</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setSelectedFields([]); setPreviewData([]) }}>
            <SelectTrigger className="min-w-[320px] w-full max-w-2xl">
              <SelectValue placeholder="Elige una tabla" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.name} value={table.name}>
                  {table.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proyectos (opcional)</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Filtrar por uno, varios o todos los proyectos. Si no eliges ninguno, se incluyen todos.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="proj-all"
                checked={projectFilter === 'all'}
                onCheckedChange={(checked) => setProjectFilter(checked ? 'all' : 'selected')}
              />
              <Label htmlFor="proj-all" className="cursor-pointer">Todos los proyectos</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="proj-selected"
                checked={projectFilter === 'selected'}
                onCheckedChange={(checked) => setProjectFilter(checked ? 'selected' : 'all')}
              />
              <Label htmlFor="proj-selected" className="cursor-pointer">Seleccionar proyectos</Label>
            </div>
            {projectFilter === 'selected' && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={selectAllProjects}>
                  Marcar todos
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAllProjects}>
                  Desmarcar todos
                </Button>
              </>
            )}
          </div>
          {projectFilter === 'selected' && (
            <div className="max-h-48 overflow-y-auto rounded-md border p-3">
              <div className="flex flex-wrap gap-4">
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedProjectIds.has(p.id)}
                      onCheckedChange={() => toggleProject(p.id)}
                    />
                    <span className="font-mono text-muted-foreground">{p.projectNumber}</span>
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Rango de fechas (opcional)
          </CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Para tablas con fechas (ej. Transacciones: Fecha Emisión). Dejar vacío = sin filtro.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-w-[180px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTable && (
        <Card>
          <CardHeader>
            <CardTitle>2. Seleccionar Campos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {availableFields.map((field) => (
                <Badge
                  key={field.field}
                  variant={selectedFields.includes(field.field) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    if (selectedFields.includes(field.field)) {
                      setSelectedFields(selectedFields.filter((f) => f !== field.field))
                    } else {
                      setSelectedFields([...selectedFields, field.field])
                    }
                  }}
                >
                  {field.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTable && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>3. Filtros (opcional)</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={handleAddFilter}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Filtro
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {filters.map((filter) => (
              <div key={filter.id} className="flex flex-wrap items-end gap-2 rounded border p-2">
                <div className="min-w-[140px] space-y-1">
                  <Label className="text-xs">Campo</Label>
                  <Select
                    value={filter.field}
                    onValueChange={(value) => {
                      setFilters(filters.map((f) => (f.id === filter.id ? { ...f, field: value } : f)))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Campo" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map((field) => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Operador</Label>
                  <Select
                    value={filter.operator}
                    onValueChange={(value: QueryFilter['operator']) => {
                      setFilters(filters.map((f) => (f.id === filter.id ? { ...f, operator: value } : f)))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px] flex-1 space-y-1">
                  <Label className="text-xs">Valor</Label>
                  <Input
                    value={filter.value !== undefined && filter.value !== null ? String(filter.value) : ''}
                    onChange={(e) => {
                      setFilters(filters.map((f) => (f.id === filter.id ? { ...f, value: e.target.value } : f)))
                    }}
                    placeholder="Valor"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFilter(filter.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={handleRunQuery} disabled={isLoading || !selectedTable || selectedFields.length === 0}>
          <Play className="mr-2 h-4 w-4" />
          {isLoading ? 'Ejecutando...' : 'Ejecutar Query'}
        </Button>
        <Button variant="outline" disabled={previewData.length === 0}>
          <Save className="mr-2 h-4 w-4" />
          Guardar Reporte
        </Button>
      </div>

      {previewData.length > 0 && currentTable && (
        <QueryBuilderPreview
          data={previewData}
          selectedFields={selectedFields}
          fields={currentTable.fields}
        />
      )}
    </div>
  )
}
