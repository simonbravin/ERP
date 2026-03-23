import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface DataTableColumn<T> {
  key: keyof T | string
  header: string
  cell?: (row: T) => React.ReactNode
  numeric?: boolean
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  keyExtractor: (row: T) => string
  stickyHeader?: boolean
  className?: string
  emptyMessage?: string
}

/**
 * Generic data table using design tokens.
 * Supports sticky headers and semantic styling.
 */
export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  stickyHeader: _stickyHeader = true,
  className,
  emptyMessage = 'No hay datos',
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'overflow-auto rounded-lg border border-border bg-card',
        className
      )}
    >
      <Table className={cn('table-sticky-header', 'table-dense')}>
        <TableHeader>
          <TableRow className="border-b border-border bg-muted hover:bg-muted">
            {columns.map((col) => (
              <TableHead
                key={String(col.key)}
                className={cn(
                  'font-semibold uppercase tracking-wide text-muted-foreground',
                  col.numeric && 'text-right',
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={keyExtractor(row)}
                className="border-b border-border transition-colors hover:bg-muted/50"
              >
                {columns.map((col) => (
                  <TableCell
                    key={String(col.key)}
                    className={cn(
                      col.numeric && 'font-mono tabular-nums text-right',
                      col.className
                    )}
                  >
                    {col.cell
                      ? col.cell(row)
                      : (row[col.key as keyof T] as React.ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
