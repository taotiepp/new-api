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
import { ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { getUserLogs, getUserLogStats } from '@/features/usage-logs/api'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { LOG_TYPE_ENUM, LOG_TYPES } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import { getUserModels } from '@/lib/api'
import { usePricingCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { dateToUnixTimestamp } from '@/lib/time'

import {
  createDefaultPortalBillingRange,
  isPortalBillingRangeTooLong,
} from '../lib/billing'
import { PortalLogDetailsDialog } from './portal-log-details-dialog'
import { PortalLogsTable } from './portal-logs-table'

const PAGE_SIZE = 20
const ALL_LOG_TYPES = 'all'

export function PortalLogsPanel() {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()
  const defaults = createDefaultPortalBillingRange()
  const [start, setStart] = useState(defaults.start)
  const [end, setEnd] = useState(defaults.end)
  const [logType, setLogType] = useState(ALL_LOG_TYPES)
  const [modelName, setModelName] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<UsageLog | null>(null)

  const rangeTooLong = isPortalBillingRangeTooLong(start, end)
  const typeValue = logType === ALL_LOG_TYPES ? undefined : Number(logType)
  const modelsQuery = useQuery({
    queryKey: ['user-portal', 'user-models'],
    queryFn: async () => {
      const result = requireServerSuccess(await getUserModels())
      return [...new Set(result.data ?? [])].sort((left, right) =>
        left.localeCompare(right)
      )
    },
    staleTime: 5 * 60 * 1000,
  })
  const models = modelsQuery.data ?? []
  const modelValue = toPortalLogModelFilter(modelName, models)
  const queryKey = [
    'user-portal',
    'logs',
    start.getTime(),
    end.getTime(),
    logType,
    modelValue ?? '',
    page,
  ] as const

  const listQuery = useQuery({
    queryKey,
    enabled: !rangeTooLong,
    queryFn: async () => {
      const result = requireServerSuccess(
        await getUserLogs({
          p: page,
          page_size: PAGE_SIZE,
          type: typeValue,
          model_name: modelValue,
          start_timestamp: dateToUnixTimestamp(start),
          end_timestamp: dateToUnixTimestamp(end),
        })
      )
      return result.data
    },
  })

  const statsQuery = useQuery({
    queryKey: ['user-portal', 'logs-stats', queryKey.slice(0, 6)],
    enabled: !rangeTooLong,
    queryFn: async () => {
      const result = requireServerSuccess(
        await getUserLogStats({
          type: typeValue,
          model_name: modelValue,
          start_timestamp: dateToUnixTimestamp(start),
          end_timestamp: dateToUnixTimestamp(end),
        })
      )
      return result.data
    },
  })

  const items = (listQuery.data?.items ?? []) as UsageLog[]
  const total = listQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const stats = statsQuery.data
  const defaultRange = createDefaultPortalBillingRange()
  const filtersAreDefault =
    start.getTime() === defaultRange.start.getTime() &&
    end.getTime() === defaultRange.end.getTime() &&
    logType === ALL_LOG_TYPES &&
    !modelValue
  const typeItems = useMemo(
    () => [
      { value: ALL_LOG_TYPES, label: t('All Types') },
      ...LOG_TYPES.filter((item) => item.value !== LOG_TYPE_ENUM.UNKNOWN).map(
        (item) => ({
          value: String(item.value),
          label: t(item.label),
        })
      ),
    ],
    [t]
  )

  const applyRange = (nextStart: Date, nextEnd: Date) => {
    if (nextEnd < nextStart) return
    if (isPortalBillingRangeTooLong(nextStart, nextEnd)) {
      toast.error(t('Select a range of at most 30 days.'))
      return
    }
    setStart(nextStart)
    setEnd(nextEnd)
    setPage(1)
  }

  let listBody
  if (rangeTooLong) {
    listBody = (
      <p className='text-destructive text-sm'>
        {t('Select a range of at most 30 days.')}
      </p>
    )
  } else if (listQuery.isError) {
    listBody = (
      <ErrorState
        title={t('Failed to load')}
        onRetry={() => {
          void listQuery.refetch()
        }}
      />
    )
  } else if (listQuery.isLoading) {
    listBody = (
      <PortalLogsTable
        logs={[]}
        loading
        onSelect={() => {
          return
        }}
      />
    )
  } else {
    listBody = (
      <PortalLogsTable logs={items} loading={false} onSelect={setSelected} />
    )
  }

  return (
    <div className='flex w-full flex-col gap-6'>
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold text-[var(--portal-ink)]'>
          {t('Request Logs')}
        </h1>
        <p className='text-muted-foreground text-sm'>
          {t('Review your API request history.')}
        </p>
      </header>

      <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-5'>
        <div className='flex flex-wrap items-center gap-2'>
          <CompactDateTimeRangePicker
            start={start}
            end={end}
            className='h-7 w-auto max-w-[min(100%,28rem)] rounded-full'
            onChange={({ start: nextStart, end: nextEnd }) => {
              if (!nextStart || !nextEnd) return
              applyRange(nextStart, nextEnd)
            }}
          />
          <Select
            items={typeItems}
            value={logType}
            onValueChange={(value) => {
              setLogType(value ?? ALL_LOG_TYPES)
              setPage(1)
            }}
          >
            <SelectTrigger
              size='sm'
              className='max-w-44 min-w-32 rounded-full'
              aria-label={t('All Types')}
            >
              <SelectValue>
                <span className='truncate'>
                  {typeItems.find((item) => item.value === logType)?.label ??
                    t('All Types')}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <PortalLogModelCombobox
            value={modelName}
            models={models}
            onValueChange={(value) => {
              setModelName(value)
              setPage(1)
            }}
          />
          {filtersAreDefault ? null : (
            <Button
              type='button'
              variant='link'
              size='sm'
              className='h-8 px-2'
              onClick={() => {
                const next = createDefaultPortalBillingRange()
                setStart(next.start)
                setEnd(next.end)
                setLogType(ALL_LOG_TYPES)
                setModelName('')
                setPage(1)
              }}
            >
              {t('Clear filters')}
            </Button>
          )}
        </div>
        {total > PAGE_SIZE ? (
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='rounded-full'
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm tabular-nums'>
              {t('Page')} {page} {t('of')} {pageCount}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='rounded-full'
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('Next page')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        {(
          [
            {
              label: t('Consumption'),
              value: formatQuota(stats?.quota ?? 0),
            },
            {
              label: t('RPM'),
              value: formatNumber(stats?.rpm ?? 0),
            },
            {
              label: t('TPM'),
              value: formatNumber(stats?.tpm ?? 0),
            },
          ] as const
        ).map((card) => (
          <article
            key={card.label}
            className='rounded-2xl bg-[var(--portal-surface-muted)] px-5 py-4'
          >
            <p className='text-muted-foreground text-sm'>{card.label}</p>
            {statsQuery.isLoading ? (
              <Skeleton className='mt-3 h-8 w-24' />
            ) : (
              <p className='mt-3 text-2xl font-semibold text-[var(--portal-ink)] tabular-nums'>
                {card.value}
              </p>
            )}
          </article>
        ))}
      </div>

      {listBody}

      <PortalLogDetailsDialog
        log={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </div>
  )
}

function toPortalLogModelFilter(
  input: string,
  models: string[]
): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  if (trimmed.includes('%')) return trimmed
  const exact = models.some(
    (model) => model.toLowerCase() === trimmed.toLowerCase()
  )
  if (exact) return trimmed
  return `${trimmed}%`
}

function PortalLogModelCombobox(props: {
  value: string
  models: string[]
  onValueChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const filteredModels = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return props.models
    return props.models.filter((model) =>
      model.toLowerCase().startsWith(search)
    )
  }, [props.models, searchValue])

  const applyValue = (next: string) => {
    props.onValueChange(next)
    setOpen(false)
    setSearchValue('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearchValue('')
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='sm'
            role='combobox'
            aria-expanded={open}
            aria-label={t('Model')}
            className='max-w-52 min-w-36 justify-between rounded-full'
          />
        }
      >
        <span className='truncate'>{props.value || t('Model')}</span>
        <ChevronsUpDown className='size-3.5 opacity-50' />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-72 overflow-hidden rounded-xl p-0'
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('Search...')}
            value={searchValue}
            onValueChange={setSearchValue}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const typed = searchValue.trim()
              if (filteredModels.length > 0 || !typed) return
              event.preventDefault()
              applyValue(typed)
            }}
          />
          <CommandList>
            <CommandEmpty>{t('No results found')}</CommandEmpty>
            <CommandGroup>
              {filteredModels.map((model) => (
                <CommandItem
                  key={model}
                  value={model}
                  onSelect={() => applyValue(model)}
                >
                  {model}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
