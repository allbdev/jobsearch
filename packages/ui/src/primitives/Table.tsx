import type { ReactNode } from 'react'
import { Blueprint } from './Blueprint'

export interface Column<Row> {
  key: string
  header: string
  /** Right-align numeric and date columns, matching the design. */
  align?: 'left' | 'right'
  render: (row: Row) => ReactNode
}

export interface DataTableProps<Row> {
  columns: readonly Column<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  emptyMessage?: string
}

/** Data table inside a blueprint frame — the only table pattern in the system. */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nothing here yet.',
}: DataTableProps<Row>) {
  return (
    <Blueprint style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.align === 'right' ? { textAlign: 'right' } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={column.align === 'right' ? { textAlign: 'right' } : undefined}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Blueprint>
  )
}
