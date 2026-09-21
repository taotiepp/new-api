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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { usePricingCurrency } from '@/lib/currency'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import {
  compactPortalBillingAxisLabel,
  PORTAL_BILLING_CHART_COLORS,
  type PortalBillingBarPoint,
} from '../lib/billing'

type PortalBillingChartProps = {
  points: PortalBillingBarPoint[]
  totalQuota: number
  loading: boolean
  title?: string
  description?: string
  showEmptyBars?: boolean
}

export function PortalBillingChart(props: PortalBillingChartProps) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()
  const { resolvedTheme, themeReady } = useChartTheme()
  const seriesNames = useMemo(
    () => [...new Set(props.points.map((point) => point.series))],
    [props.points]
  )
  const axisBuckets = useMemo(
    () => [...new Set(props.points.map((point) => point.bucket))],
    [props.points]
  )

  const spec = useMemo(
    () => ({
      type: 'bar' as const,
      data: [{ id: 'billing', values: props.points }],
      xField: 'bucket',
      yField: 'quota',
      seriesField: 'series',
      stack: true,
      color: {
        type: 'ordinal' as const,
        domain: seriesNames,
        range: PORTAL_BILLING_CHART_COLORS,
      },
      padding: { top: 12, right: 8, bottom: 28, left: 8 },
      legends: {
        visible: seriesNames.length > 1,
        position: 'bottom' as const,
        select: true,
        selectMode: 'multiple' as const,
      },
      axes: [
        {
          orient: 'bottom' as const,
          trim: true,
          sampling: axisBuckets.length > 6,
          tick: { visible: false },
          label: {
            autoHide: axisBuckets.length > 6,
            autoHideSeparation: 4,
            autoLimit: true,
            flush: true,
            formatMethod: (value: string | number) =>
              compactPortalBillingAxisLabel(String(value), axisBuckets),
          },
        },
        { orient: 'left' as const, min: 0 },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: { series?: string }) => datum.series ?? '',
              value: (datum: { quota?: number }) =>
                formatQuota(Number(datum.quota) || 0),
            },
          ],
        },
      },
    }),
    [axisBuckets, props.points, seriesNames, formatQuota]
  )

  const hasQuota = props.points.some((point) => point.quota > 0)

  let chartBody = (
    <div className='h-64 sm:h-80'>
      {themeReady ? (
        <VChart
          key={`${seriesNames.join('|')}-${axisBuckets.length}-${resolvedTheme}`}
          spec={{
            ...spec,
            theme: resolvedTheme === 'dark' ? 'dark' : 'light',
            background: 'transparent',
          }}
          option={VCHART_OPTION}
        />
      ) : (
        <Skeleton className='h-full w-full rounded-xl' />
      )}
    </div>
  )
  if (props.loading) {
    chartBody = <Skeleton className='h-64 w-full rounded-xl' />
  } else if (!hasQuota && !props.showEmptyBars) {
    chartBody = (
      <EmptyState
        title={t('No data available')}
        className='min-h-64 border-0 bg-transparent'
      />
    )
  }

  return (
    <section className='rounded-2xl bg-[var(--portal-surface-muted)] p-4 sm:p-5'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-col gap-1'>
          <p className='text-sm font-medium text-[var(--portal-ink)]'>
            {props.title ?? t('Consumption')}
            <span className='ml-2 text-[var(--portal-ink-muted)] tabular-nums'>
              {formatQuota(props.totalQuota)}
            </span>
          </p>
          {props.description ? (
            <p className='text-muted-foreground text-xs'>{props.description}</p>
          ) : null}
        </div>
      </div>
      {chartBody}
    </section>
  )
}
