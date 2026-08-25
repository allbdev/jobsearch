'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Blueprint } from './Blueprint'
import { cx } from '../lib/cx'
import styles from './Table.module.css'
import { useUiLabels } from '../i18n/labels'

export interface Column<Row> {
  key: string
  header: string
  /** Right-align numeric and date columns. Desktop only — a card has no columns. */
  align?: 'left' | 'right'
  /**
   * Where this cell sits in the mobile card, matching a name in the table's
   * `mobileAreas` template. Ignored on desktop, where the cell is a table-cell.
   */
  mobileArea?: string
  /** Drop this column from the mobile card — usually because context implies it. */
  hideOnMobile?: boolean
  render: (row: Row) => ReactNode
}

export interface DataTableProps<Row> {
  columns: readonly Column<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  emptyMessage?: string
  /**
   * `grid-template-areas` for the mobile card, e.g.
   * `'"title date" "company badge"'`. Without it the cells simply stack.
   */
  mobileAreas?: string
}

/** Data table inside a blueprint frame; a stack of cards below `--bp-md`. */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  mobileAreas,
}: DataTableProps<Row>) {
  const labels = useUiLabels()
  const areaStyle = mobileAreas
    ? ({ '--mobile-areas': mobileAreas } as CSSProperties)
    : undefined

  const cellStyle = (column: Column<Row>): CSSProperties | undefined =>
    column.mobileArea ? { gridArea: column.mobileArea } : undefined

  const visible = columns.filter((column) => !column.hideOnMobile)

  return (
    <Blueprint className={styles.frame}>
      <table className={cx('table', styles.table)} style={areaStyle}>
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
              <td colSpan={visible.length} className="text-muted">
                {emptyMessage ?? labels.emptyTable}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      column.align === 'right' && styles.alignRight,
                      column.hideOnMobile && styles.hideOnMobile,
                    )}
                    style={{
                      ...(column.align === 'right' ? { textAlign: 'right' as const } : {}),
                      ...cellStyle(column),
                    }}
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
