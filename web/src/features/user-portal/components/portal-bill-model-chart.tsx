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
import { VChart } from '@visactor/react-vchart'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { usePricingCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import {
  PORTAL_BILL_MODEL_LIMIT,
  PORTAL_BILLING_CHART_COLORS,
  type PortalModelShare,
} from '../lib/billing'

type PortalBillModelChartProps = {
  shares: PortalModelShare[]
  loading: boolean
}

export function PortalBillModelChart(props: PortalBillModelChartProps) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()
  const { resolvedTheme, themeReady } = useChartTheme()
  const othersLabel = t('Other models')
  const chartShares = useMemo(() => {
    if (props.shares.length <= PORTAL_BILL_MODEL_LIMIT) return props.shares
    const head = props.shares.slice(0, PORTAL_BILL_MODEL_LIMIT)
    const tail = props.shares.slice(PORTAL_BILL_MODEL_LIMIT)
    const other = tail.reduce(
      (acc, item) => ({
        model: othersLabel,
        quota: acc.quota + item.quota,
        count: acc.count + item.count,
        tokens: acc.tokens + item.tokens,
        ratio: acc.ratio + item.ratio,
      }),
      { model: othersLabel, quota: 0, count: 0, tokens: 0, ratio: 0 },
    )
    return [...head, other]
  }, [othersLabel, props.shares])
  const values = useMemo(
    () =>
      chartShares.map((share) => ({
        model: share.model,
        quota: share.quota,
      })),
    [chartShares],
  )

  const spec = useMemo(
    () => ({
      type: 'pie' as const,
      data: [{ id: 'models', values }],
      valueField: 'quota',
      categoryField: 'model',
      outerRadius: 0.88,
      innerRadius: 0.58,
      padAngle: 0.6,
      color: {
        type: 'ordinal' as const,
        domain: values.map((item) => item.model),
        range: PORTAL_BILLING_CHART_COLORS,
      },
      legends: { visible: false },
      label: { visible: false },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: { model?: string }) => datum.model ?? '',
              value: (datum: { quota?: number }) =>
                formatQuota(Number(datum.quota) || 0),
            },
          ],
        },
      },
      pie: {
        style: {
          stroke: 'transparent',
        },
      },
    }),
    [formatQuota, values],
  )

  const columns = useMemo<StaticDataTableColumn<PortalModelShare>[]>(
    () => [
      {
        id: 'model',
        header: t('Model'),
        cellClassName: 'max-w-56 font-medium',
        cell: (share) => share.model,
      },
      {
        id: 'count',
        header: t('Requests'),
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (share) => formatNumber(share.count),
      },
      {
        id: 'tokens',
        header: t('Tokens'),
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (share) => formatNumber(share.tokens),
      },
      {
        id: 'quota',
        header: t('Amount'),
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (share) => formatQuota(share.quota),
      },
      {
        id: 'share',
        header: t('Share'),
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (share) => `${(share.ratio * 100).toFixed(2)}%`,
      },
    ],
    [formatQuota, t],
  )

  const hasQuota = props.shares.some((share) => share.quota > 0)

  let chartBody = (
    <div className='h-56 w-full max-w-64'>
      {themeReady ? (
        <VChart
          key={`${values.map((item) => item.model).join('|')}-${resolvedTheme}`}
          spec={{
            ...spec,
            theme: resolvedTheme === 'dark' ? 'dark' : 'light',
            background: 'transparent',
          }}
          option={VCHART_OPTION}
        />
      ) : (
        <Skeleton className='h-full w-full rounded-full' />
      )}
    </div>
  )
  if (props.loading) {
    chartBody = <Skeleton className='h-56 w-full max-w-64 rounded-full' />
  } else if (!hasQuota) {
    chartBody = (
      <EmptyState
        title={t('No bill data for this month.')}
        className='min-h-56 border-0 bg-transparent'
      />
    )
  }

  let tableBody: ReactNode = null
  if (props.loading) {
    tableBody = <Skeleton className='mt-6 h-40 w-full rounded-xl' />
  } else if (hasQuota) {
    tableBody = (
      <div className='mt-6'>
        <StaticDataTable
          columns={columns}
          data={props.shares}
          getRowKey={(share) => share.model}
          headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
        />
      </div>
    )
  }

  return (
    <section className='rounded-2xl bg-[var(--portal-surface-muted)] p-4 sm:p-5'>
      <div className='mb-4'>
        <p className='text-sm font-medium text-[var(--portal-ink)]'>
          {t('Summary by model')}
        </p>
      </div>
      <div className='flex flex-col items-center gap-6 lg:flex-row lg:items-start'>
        {chartBody}
        {hasQuota && !props.loading ? (
          <ul className='flex min-w-0 flex-1 flex-col gap-3'>
            {chartShares.map((share, index) => (
              <li
                key={share.model}
                className='flex min-w-0 items-center justify-between gap-4 text-sm'
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <span
                    aria-hidden
                    className='size-2.5 shrink-0 rounded-full'
                    style={{
                      backgroundColor:
                        PORTAL_BILLING_CHART_COLORS[
                          index % PORTAL_BILLING_CHART_COLORS.length
                        ],
                    }}
                  />
                  <span className='truncate text-[var(--portal-ink)]'>
                    {share.model}
                  </span>
                </span>
                <span className='shrink-0 tabular-nums text-[var(--portal-ink-muted)]'>
                  {(share.ratio * 100).toFixed(2)}% · {formatQuota(share.quota)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {tableBody}
    </section>
  )
}
