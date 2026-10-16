/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import {
  StatusBadge,
  type StatusBadgeProps,
} from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'
import { LogCostDisplay } from '@/features/usage-logs/components/log-cost-display'
import { StreamTpsCell } from '@/features/usage-logs/components/timing-metrics-cell'
import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import { parseLogOther } from '@/features/usage-logs/lib/format'
import { getLogTypeConfig, isTimingLogType } from '@/features/usage-logs/lib/utils'
import dayjs from '@/lib/dayjs'
import { formatNumber, formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const LOADING_ROWS = [0, 1, 2, 3] as const
const DASH = '—'

type PortalLogsTableProps = {
  logs: UsageLog[]
  loading: boolean
  onSelect: (log: UsageLog) => void
}

export function PortalLogsTable(props: PortalLogsTableProps) {
  const { t } = useTranslation()
  const numericClass = staticDataTableClassNames.compactNumericCell
  const columns = useMemo<StaticDataTableColumn<UsageLog>[]>(
    () => [
      {
        id: 'time',
        header: t('Time'),
        cell: (log) => dayjs.unix(log.created_at).format('MM/DD HH:mm:ss'),
      },
      {
        id: 'type',
        header: t('Type'),
        cell: (log) => {
          const config = getLogTypeConfig(log.type)
          return (
            <StatusBadge
              label={t(config.label)}
              variant={config.color as StatusBadgeProps['variant']}
              size='sm'
              copyable={false}
            />
          )
        },
      },
      {
        id: 'model',
        header: t('Model'),
        cellClassName: 'max-w-44 font-medium',
        cell: (log) => log.model_name || t('Unknown model'),
      },
      {
        id: 'token',
        header: t('API Key'),
        cellClassName: staticDataTableClassNames.compactMutedCell,
        cell: (log) => log.token_name || DASH,
      },
      {
        id: 'content',
        header: t('Content'),
        cellClassName: 'max-w-72',
        cell: (log) => {
          if (!log.content) return DASH
          return (
            <span
              className={cn(
                'line-clamp-3 break-all whitespace-pre-wrap',
                log.type === LOG_TYPE_ENUM.ERROR &&
                  'text-red-600 dark:text-red-400'
              )}
            >
              {log.content}
            </span>
          )
        },
      },
      {
        id: 'input',
        header: t('Input'),
        cellClassName: numericClass,
        cell: (log) =>
          isTimingLogType(log.type) ? formatNumber(log.prompt_tokens) : DASH,
      },
      {
        id: 'output',
        header: t('Output'),
        cellClassName: numericClass,
        cell: (log) =>
          isTimingLogType(log.type)
            ? formatNumber(log.completion_tokens)
            : DASH,
      },
      {
        id: 'cache',
        header: t('Cache'),
        cellClassName: numericClass,
        cell: (log) =>
          isTimingLogType(log.type) ? formatNumber(cacheTokenTotal(log)) : DASH,
      },
      {
        id: 'duration',
        header: t('Duration'),
        cellClassName: numericClass,
        cell: (log) =>
          isTimingLogType(log.type) ? formatUseTime(log.use_time) : DASH,
      },
      {
        id: 'stream',
        header: t('Stream'),
        cell: (log) => {
          if (!isTimingLogType(log.type)) return DASH
          const other = parseLogOther(log.other)
          const tokensPerSecond =
            log.use_time > 0 && log.completion_tokens > 0
              ? log.completion_tokens / log.use_time
              : null
          return (
            <StreamTpsCell
              className='min-h-5 min-w-0'
              isStream={log.is_stream}
              isTask={other?.is_task === true}
              tokensPerSecond={tokensPerSecond}
              streamStatus={other?.stream_status}
            />
          )
        },
      },
      {
        id: 'cost',
        header: t('Cost'),
        cellClassName: cn(numericClass, 'font-semibold'),
        cell: (log) => (
          <LogCostDisplay quota={log.quota} other={parseLogOther(log.other)} />
        ),
      },
    ],
    [numericClass, t]
  )

  if (props.loading) {
    const loadingColumns: StaticDataTableColumn<number>[] = columns.map(
      (column) => ({
        id: column.id,
        header: column.header,
        cell: () => <Skeleton className='h-4 w-16' />,
      })
    )
    return (
      <StaticDataTable
        className='rounded-none border-x-0 border-b-0 border-t border-[var(--portal-hairline)] bg-transparent'
        headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
        columns={loadingColumns}
        data={[...LOADING_ROWS]}
        getRowKey={(row) => row}
      />
    )
  }

  return (
    <StaticDataTable
      className='rounded-none border-x-0 border-b-0 border-t border-[var(--portal-hairline)] bg-transparent'
      headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
      columns={columns}
      data={props.logs}
      getRowKey={(log) => log.id}
      emptyContent={t('No logs')}
      renderRow={(log) => (
        <TableRow
          tabIndex={0}
          className={cn(
            'cursor-pointer',
            log.type === LOG_TYPE_ENUM.ERROR &&
              'bg-rose-50/40 hover:bg-rose-50/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/30'
          )}
          onClick={() => props.onSelect(log)}
          onKeyDown={(event) => {
            selectLogOnActivate(event, log, props.onSelect)
          }}
        >
          {columns.map((column) => (
            <TableCell
              key={column.id}
              className={cn(
                'max-w-full min-w-0 overflow-hidden',
                typeof column.cellClassName === 'function'
                  ? column.cellClassName(log, 0)
                  : column.cellClassName
              )}
            >
              {column.cell?.(log, 0)}
            </TableCell>
          ))}
        </TableRow>
      )}
    />
  )
}

function cacheTokenTotal(log: UsageLog): number {
  const other = parseLogOther(log.other)
  if (!other) return 0
  return (
    (other.cache_tokens || 0) +
    (other.cache_creation_tokens || 0) +
    (other.cache_creation_tokens_5m || 0) +
    (other.cache_creation_tokens_1h || 0)
  )
}

function selectLogOnActivate(
  event: KeyboardEvent<HTMLTableRowElement>,
  log: UsageLog,
  onSelect: (log: UsageLog) => void
) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onSelect(log)
}
