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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTheme } from '@/context/theme-provider'
import { formatQuota } from '@/lib/format'
import { VCHART_OPTION } from '@/lib/vchart'

import {
  PORTAL_BILLING_CHART_COLORS,
  type PortalBillingBarPoint,
  type PortalBillingGroup,
} from '../lib/billing'

type PortalBillingChartProps = {
  points: PortalBillingBarPoint[]
  group: PortalBillingGroup
  onGroupChange: (group: PortalBillingGroup) => void
  totalQuota: number
  loading: boolean
}

export function PortalBillingChart(props: PortalBillingChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const stacked = props.group === 'model'

  useEffect(() => {
    let cancelled = false
    void import('@visactor/vchart').then((mod) => {
      if (cancelled) return
      mod.ThemeManager.setCurrentTheme(
        resolvedTheme === 'dark' ? 'dark' : 'light',
      )
      setThemeReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [resolvedTheme])

  const spec = useMemo(
    () => ({
      type: 'bar' as const,
      data: [{ id: 'billing', values: props.points }],
      xField: 'bucket',
      yField: 'quota',
      seriesField: stacked ? 'series' : undefined,
      stack: stacked,
      color: PORTAL_BILLING_CHART_COLORS,
      padding: { top: 12, right: 8, bottom: 8, left: 8 },
      legends: {
        visible: stacked,
        position: 'bottom' as const,
        select: false,
      },
      axes: [
        { orient: 'bottom' as const, sampling: false },
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
    [props.points, stacked],
  )

  const hasQuota = props.points.some((point) => point.quota > 0)

  let chartBody = (
    <div className='h-64 sm:h-80'>
      {themeReady ? (
        <VChart
          key={`${props.group}-${props.points.length}-${resolvedTheme}`}
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
  } else if (!hasQuota) {
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
        <p className='text-sm font-medium text-[var(--portal-ink)]'>
          {t('Consumption')}
          <span className='text-[var(--portal-ink-muted)] ml-2 tabular-nums'>
            {formatQuota(props.totalQuota)}
          </span>
        </p>
        <Tabs
          value={props.group}
          onValueChange={(value) => {
            if (value === 'model' || value === 'api_key') {
              props.onGroupChange(value)
            }
          }}
        >
          <TabsList className='rounded-full'>
            <TabsTrigger value='model' className='rounded-full px-3'>
              {t('Model')}
            </TabsTrigger>
            <TabsTrigger value='api_key' className='rounded-full px-3'>
              {t('API Key')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {chartBody}
    </section>
  )
}
