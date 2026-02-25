/**
 * Print-friendly table: thead repeats on each page when printing.
 * Use for tabular data in /print routes.
 */
export type PrintTableColumn<T = unknown> = {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  format?: (value: unknown, row: T) => string
}

type PrintTableProps<T = Record<string, unknown>> = {
  columns: PrintTableColumn<T>[]
  rows: T[]
  totals?: Partial<Record<string, string | number>> | null
  totalsLabel?: string
  className?: string
}

function defaultFormat(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return String(value)
}

export function PrintTable<T extends Record<string, unknown>>({
  columns,
  rows,
  totals,
  totalsLabel = 'Total',
  className = '',
}: PrintTableProps<T>) {
  return (
    <table className={`print-table ${className}`.trim()}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            {columns.map((col) => {
              const value = row[col.key]
              const formatted = col.format ? col.format(value, row) : defaultFormat(value)
              return (
                <td
                  key={col.key}
                  className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                >
                  {formatted}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
      {totals != null && Object.keys(totals).length > 0 && (
        <tfoot>
          <tr>
            {columns.map((col, idx) => (
              <td
                key={col.key}
                className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
              >
                {idx === 0 ? totalsLabel : (totals[col.key] != null ? String(totals[col.key]) : '')}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  )
}
