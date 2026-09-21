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
import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { usePricingCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { dateToUnixTimestamp } from '@/lib/time'

import { usePortalBills } from '../hooks/use-portal-billing-data'
import {
  buildPortalCostTrend,
  createPortalBillMonthRange,
  listPortalBillMonths,
  summarizePortalBillingByModel,
} from '../lib/billing'
import { PortalBillInvoiceDialog } from './portal-bill-invoice-dialog'
import { PortalBillModelChart } from './portal-bill-model-chart'
import { PortalBillingChart } from './portal-billing-chart'

export function PortalBillPanel() {
  const { t } = useTranslation()
  const { currency: catalogCurrency, formatQuota } = usePricingCurrency()
  const months = useMemo(() => listPortalBillMonths(), [])
  const [monthValue, setMonthValue] = useState(months[0]?.value ?? '')
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const selectedMonth =
    months.find((month) => month.value === monthValue) ?? months[0]
  const range = useMemo(
    () => createPortalBillMonthRange(selectedMonth?.date ?? new Date()),
    [selectedMonth],
  )
  const bills = usePortalBills(monthValue)
  const unknownModel = t('Unknown model')
  const othersLabel = t('Other models')
  const overview = bills.data
  const shares = useMemo(
    () =>
      summarizePortalBillingByModel(
        (overview?.items ?? []).map((item) => ({
          created_at: 0,
          model_name: item.model_name,
          quota: item.quota,
          count: item.count,
          token_used: item.token_used,
        })),
        unknownModel,
        othersLabel,
      ),
    [othersLabel, overview?.items, unknownModel],
  )
  const trendPoints = useMemo(
    () => buildPortalCostTrend(overview?.trend ?? [], t('Cost trend')),
    [overview?.trend, t],
  )
  const trendTotal = useMemo(
    () =>
      (overview?.trend ?? []).reduce(
        (sum, month) => sum + (Number(month.quota) || 0),
        0,
      ),
    [overview?.trend],
  )
  const isCurrentMonth = dayjs(selectedMonth?.date).isSame(new Date(), 'month')

  return (
    <div className='flex w-full flex-col gap-6'>
      <header className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold tracking-tight text-[var(--portal-ink)]'>
            {t('Bill Management')}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Monthly statements group consumption by calendar month. Open usage statistics for custom ranges and daily trends.',
            )}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Select
            items={months.map((month) => ({
              value: month.value,
              label: month.value,
            }))}
            value={monthValue}
            onValueChange={(value) => {
              if (value) setMonthValue(value)
            }}
          >
            <SelectTrigger
              size='sm'
              className='w-40 rounded-full'
              aria-label={t('Billing period')}
            >
              <SelectValue>
                <span>{monthValue}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type='button'
            size='sm'
            className='rounded-full'
            onClick={() => setInvoiceOpen(true)}
            disabled={bills.isLoading || bills.isError}
          >
            <Download className='size-3.5' />
            {t('Export invoice')}
          </Button>
          <Link
            to='/app/usage'
            search={{
              startTime: dateToUnixTimestamp(range.start),
              endTime: dateToUnixTimestamp(range.end),
            }}
            className='text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline'
          >
            {t('View daily usage')}
          </Link>
        </div>
      </header>

      <p className='text-muted-foreground rounded-2xl bg-[var(--portal-surface-muted)] px-4 py-3 text-sm'>
        {isCurrentMonth
          ? t('This month is still accumulating.')
          : t('Bill overview')}
      </p>

      <div className='grid gap-3 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]'>
        <article className='rounded-2xl bg-[var(--portal-surface-muted)] p-5'>
          <p className='text-muted-foreground text-sm'>
            {t('{{month}} bill', { month: monthValue })}
          </p>
          <p className='mt-3 text-3xl font-semibold tracking-tight tabular-nums'>
            {bills.isLoading ? (
              <Skeleton className='h-9 w-32' />
            ) : (
              <>
                {formatQuota(overview?.quota ?? 0)}
                <span className='text-muted-foreground ml-2 text-sm font-medium'>
                  {catalogCurrency}
                </span>
              </>
            )}
          </p>
        </article>
        <PortalBillingChart
          title={t('Cost trend')}
          description={t('Last 6 months')}
          showEmptyBars
          points={trendPoints}
          totalQuota={trendTotal}
          loading={bills.isLoading}
        />
      </div>

      {bills.isError ? (
        <ErrorState
          className='min-h-48'
          title={t('Failed to load bills')}
        />
      ) : (
        <PortalBillModelChart shares={shares} loading={bills.isLoading} />
      )}
      <PortalBillInvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        period={monthValue}
        isCurrentMonth={isCurrentMonth}
        items={overview?.items ?? []}
      />
    </div>
  )
}
