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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createPortalBillMonthRange,
  listPortalBillMonths,
} from '@/features/user-portal/lib/billing'

import { getAccountMonthCosts } from './api'
import { AccountCostTable } from './components/account-cost-table'

export function OperationsPage() {
  const { t } = useTranslation()
  const months = useMemo(() => listPortalBillMonths(), [])
  const [monthValue, setMonthValue] = useState(months[0]?.value ?? '')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const appliedQuery = useRef('')
  const month = months.find((item) => item.value === monthValue) ?? months[0]
  const range = createPortalBillMonthRange(month?.date)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = keyword.trim()
      if (next === appliedQuery.current) return
      appliedQuery.current = next
      setQuery(next)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keyword])

  const costs = useQuery({
    queryKey: ['account-month-costs', monthValue, query, page],
    enabled: monthValue.length > 0,
    queryFn: () =>
      getAccountMonthCosts({ period: monthValue, keyword: query, page }),
  })

  const items = costs.data?.items ?? []
  const total = costs.data?.total ?? 0
  const pageSize = costs.data?.page_size ?? 20
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentMonth = months[0]?.value === monthValue

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Select
          items={months.map((item) => ({ value: item.value, label: item.value }))}
          value={monthValue}
          onValueChange={(value) => {
            if (!value || value === monthValue) return
            setMonthValue(value)
            setPage(1)
          }}
        >
          <SelectTrigger size='sm' className='w-40' aria-label={t('Billing period')}>
            <SelectValue>
              <span>{monthValue}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {months.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.value}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Input
          aria-label={t('Search accounts')}
          placeholder={t('Search accounts')}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>
      {currentMonth ? (
        <p className='text-muted-foreground text-sm'>
          {t('This month is still accumulating.')}
        </p>
      ) : null}
      {costs.isLoading ? <LoadingState /> : null}
      {costs.isError ? (
        <ErrorState
          description={costs.error.message}
          title={t('Could not load account costs')}
          onRetry={() => void costs.refetch()}
        />
      ) : null}
      {costs.isSuccess && items.length === 0 ? (
        <EmptyState
          description={t('No accounts match this search.')}
          title={t('No accounts yet')}
        />
      ) : null}
      {costs.isSuccess && items.length > 0 ? (
        <AccountCostTable accounts={items} start={range.start} end={range.end} />
      ) : null}
      {total > pageSize ? (
        <div className='flex items-center justify-end gap-2'>
          <Button
            disabled={page <= 1}
            type='button'
            variant='outline'
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('Previous')}
          </Button>
          <Button
            disabled={page >= pageCount}
            type='button'
            variant='outline'
            onClick={() => setPage((current) => current + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
