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
import { Link } from '@tanstack/react-router'
import { CalendarDays, CircleHelp, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { parseUserSettings } from '@/features/profile/lib/format'
import { usePricingCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import { getEndOfDay, getStartOfDay } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

import { usePortalBillingData } from '../hooks/use-portal-billing-data'
import {
  PORTAL_BILL_MAX_RANGE_SECONDS,
  PORTAL_BILLING_ALL_MODELS,
  buildPortalBillingCsv,
  buildPortalTimeSeries,
  createDefaultPortalBillingRange,
  filterRowsByModelName,
  formatPortalBillingRangeLabel,
  isDefaultPortalBillingRange,
  isPortalBillingRangeTooLong,
  listPortalBillingModels,
  sumPortalBillingStats,
} from '../lib/billing'
import { PortalBillingChart } from './portal-billing-chart'

type PortalBillingPanelProps = {
  initialStart?: Date
  initialEnd?: Date
}

const RANGE_PRESETS = [
  { labelKey: 'Today', days: 1 },
  { labelKey: '7 Days', days: 7 },
  { labelKey: '14 Days', days: 14 },
  { labelKey: '29 Days', days: 29 },
] as const

export function PortalBillingPanel(props: PortalBillingPanelProps) {
  const { t } = useTranslation()
  const { currency: catalogCurrency, formatQuota } = usePricingCurrency()
  const user = useAuthStore((state) => state.auth.user)
  const seededRange =
    props.initialStart &&
    props.initialEnd &&
    !isPortalBillingRangeTooLong(
      props.initialStart,
      props.initialEnd,
      PORTAL_BILL_MAX_RANGE_SECONDS,
    )
      ? {
          start: getStartOfDay(props.initialStart),
          end: getEndOfDay(props.initialEnd),
        }
      : createDefaultPortalBillingRange()
  const [start, setStart] = useState(seededRange.start)
  const [end, setEnd] = useState(seededRange.end)
  const seededFromBill =
    props.initialStart != null &&
    props.initialEnd != null &&
    start.getTime() === seededRange.start.getTime() &&
    end.getTime() === seededRange.end.getTime()
  const [modelName, setModelName] = useState(PORTAL_BILLING_ALL_MODELS)
  const [rangeOpen, setRangeOpen] = useState(false)

  const billing = usePortalBillingData(
    start,
    end,
    seededFromBill
      ? PORTAL_BILL_MAX_RANGE_SECONDS
      : undefined,
  )
  const unknownModel = t('Unknown model')
  const selectedModelName =
    modelName === PORTAL_BILLING_ALL_MODELS ? null : modelName
  const quotaRows = useMemo(
    () =>
      filterRowsByModelName(billing.quotaRows, selectedModelName, unknownModel),
    [billing.quotaRows, selectedModelName, unknownModel]
  )

  const points = useMemo(
    () => buildPortalTimeSeries(quotaRows, start, end, unknownModel),
    [end, quotaRows, start, unknownModel]
  )

  const stats = useMemo(() => sumPortalBillingStats(quotaRows), [quotaRows])

  const modelItems = useMemo(() => {
    const names = listPortalBillingModels(billing.quotaRows, unknownModel)
    const items = [
      { value: PORTAL_BILLING_ALL_MODELS, label: t('All models') },
      ...names.map((name) => ({ value: name, label: name })),
    ]
    if (modelName !== PORTAL_BILLING_ALL_MODELS && !names.includes(modelName)) {
      items.push({ value: modelName, label: modelName })
    }
    return items
  }, [billing.quotaRows, modelName, t, unknownModel])

  let settingJson: string | undefined
  if (typeof user?.setting === 'string') {
    settingJson = user.setting
  } else if (user?.setting) {
    settingJson = JSON.stringify(user.setting)
  }
  const warningOff =
    (parseUserSettings(settingJson).quota_warning_threshold ?? 0) === 0
  const filtersAreDefault = isDefaultPortalBillingRange(start, end, modelName)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const applyRange = (nextStart: Date, nextEnd: Date) => {
    if (nextEnd < nextStart) return
    if (isPortalBillingRangeTooLong(nextStart, nextEnd)) {
      toast.error(t('Select a range of at most 30 days.'))
      return
    }
    setStart(nextStart)
    setEnd(nextEnd)
    setRangeOpen(false)
  }

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) return
    const nextStart = getStartOfDay(range.from)
    const nextEnd = getEndOfDay(range.to ?? range.from)
    applyRange(nextStart, nextEnd)
  }

  const handleExport = () => {
    const csv = buildPortalBillingCsv(points)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `usage-${dayjs(start).format('YYYYMMDD')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='flex w-full flex-col gap-6'>
      <header className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold tracking-tight text-[var(--portal-ink)]'>
            {t('Usage information')}
          </h1>
          <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
          {t(
            'Dates are shown in {{timezone}}. Usage data may be delayed by a few minutes.',
            { timezone }
          )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type='button'
                    className='text-muted-foreground inline-flex'
                    aria-label={t(
                      'Dates are shown in {{timezone}}. Usage data may be delayed by a few minutes.',
                      { timezone }
                    )}
                  >
                    <CircleHelp className='size-3.5' />
                  </button>
                }
              />
              <TooltipContent>
                {t(
                  'Dates are shown in {{timezone}}. Usage data may be delayed by a few minutes.',
                  { timezone }
                )}
              </TooltipContent>
            </Tooltip>
          </p>
        </div>
        <Link
          to='/app/bills'
          className='text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline'
        >
          {t('Bill Management')}
        </Link>
      </header>

      <div className='grid gap-3 sm:grid-cols-2'>
        <article className='rounded-2xl bg-[var(--portal-surface-muted)] p-5'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p className='text-muted-foreground flex items-center gap-1 text-sm'>
                {t('Recharge balance')}
              </p>
              {warningOff ? (
                <p className='mt-1 text-xs text-amber-700 dark:text-amber-400'>
                  {t('Balance alert is off')}{' '}
                  <Link to='/profile' className='underline underline-offset-2'>
                    {t('Go to settings')}
                  </Link>
                </p>
              ) : null}
              <p className='mt-3 text-3xl font-semibold tracking-tight tabular-nums'>
                {formatQuota(user?.quota ?? 0)}
                <span className='text-muted-foreground ml-2 text-sm font-medium'>
                  {catalogCurrency}
                </span>
              </p>
            </div>
            <Button
              size='sm'
              className='rounded-full'
              render={<Link to='/wallet' />}
            >
              {t('Recharge')}
            </Button>
          </div>
        </article>
        <article className='rounded-2xl bg-[var(--portal-surface-muted)] p-5'>
          <p className='text-muted-foreground text-sm'>
            {t('Total consumption')}
          </p>
          <p className='mt-3 text-3xl font-semibold tracking-tight tabular-nums'>
            {formatQuota(user?.used_quota ?? 0)}
            <span className='text-muted-foreground ml-2 text-sm font-medium'>
              {catalogCurrency}
            </span>
          </p>
        </article>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-5'>
        <div className='flex flex-wrap items-center gap-2'>
          <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
            <PopoverTrigger
              render={
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='rounded-full'
                />
              }
            >
              <CalendarDays className='size-3.5' />
              {t('Time dimension')}
              <span className='font-medium'>
                {formatPortalBillingRangeLabel(start, end)}
              </span>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-auto p-3'>
              <div className='mb-3 flex flex-wrap gap-1.5'>
                {RANGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.days}
                    type='button'
                    size='sm'
                    variant='outline'
                    className='rounded-full'
                    onClick={() => {
                      const nextEnd = getEndOfDay()
                      const nextStart = getStartOfDay()
                      nextStart.setDate(nextStart.getDate() - (preset.days - 1))
                      applyRange(nextStart, nextEnd)
                    }}
                  >
                    {t(preset.labelKey)}
                  </Button>
                ))}
              </div>
              <Calendar
                mode='range'
                selected={{ from: start, to: end }}
                onSelect={handleRangeSelect}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
          <Select
            items={modelItems}
            value={modelName}
            onValueChange={(value) =>
              setModelName(value ?? PORTAL_BILLING_ALL_MODELS)
            }
          >
            <SelectTrigger
              size='sm'
              className='max-w-52 min-w-36 rounded-full'
              aria-label={t('Model')}
            >
              <SelectValue>
                <span className='truncate'>
                  {t('Model')}{' '}
                  {modelItems.find((item) => item.value === modelName)?.label ??
                    t('All models')}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {modelItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {!filtersAreDefault ? (
            <Button
              type='button'
              variant='link'
              size='sm'
              className='h-8 px-2'
              onClick={() => {
                const next = createDefaultPortalBillingRange()
                setStart(next.start)
                setEnd(next.end)
                setModelName(PORTAL_BILLING_ALL_MODELS)
              }}
            >
              {t('Clear filters')}
            </Button>
          ) : null}
        </div>
        <Button
          type='button'
          size='sm'
          className='rounded-full'
          onClick={handleExport}
          disabled={billing.isLoading || points.length === 0}
        >
          <Download className='size-3.5' />
          {t('Export')}
        </Button>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        {(
          [
            {
              label: t('Consumption'),
              value: formatQuota(stats.quota),
              code: catalogCurrency,
            },
            {
              label: t('API request count'),
              value: formatNumber(stats.count),
              code: '',
            },
            {
              label: t('Tokens'),
              value: formatNumber(stats.tokens),
              code: '',
            },
          ] as const
        ).map((card) => (
          <article
            key={card.label}
            className='rounded-2xl bg-[var(--portal-surface-muted)] px-5 py-4'
          >
            <p className='text-muted-foreground text-sm'>{card.label}</p>
            {billing.isLoading ? (
              <Skeleton className='mt-3 h-8 w-24' />
            ) : (
              <p className='mt-3 text-2xl font-semibold tracking-tight tabular-nums'>
                {card.value}
                {card.code ? (
                  <span className='text-muted-foreground ml-2 text-sm font-medium'>
                    {card.code}
                  </span>
                ) : null}
              </p>
            )}
          </article>
        ))}
      </div>

      {billing.rangeTooLong ? (
        <p className='text-destructive text-sm'>
          {t('Select a range of at most 30 days.')}
        </p>
      ) : (
        <PortalBillingChart
          points={points}
          totalQuota={stats.quota}
          loading={billing.isLoading}
        />
      )}
    </div>
  )
}
