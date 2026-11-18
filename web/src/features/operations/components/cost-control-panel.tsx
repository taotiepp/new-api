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

import { StaticDataTable } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { listPortalBillMonths } from '@/features/user-portal/lib/billing'
import { searchChannels } from '@/features/channels/api'
import { searchUsers } from '@/features/users/api'
import { useDebounce } from '@/hooks/use-debounce'
import { usePricingCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getMonthCostControl } from '../api'
import type {
  CostControlDimension,
  CostControlView,
  MonthCostRow,
} from '../types'

const USER_DIMENSIONS: CostControlDimension[] = [
  'group',
  'channel',
  'token',
  'model',
]
const CHANNEL_DIMENSIONS: CostControlDimension[] = ['user', 'model']

type PickedEntity = {
  id: number
  label: string
}

export function CostControlPanel(props: {
  initialPeriod?: string
  initialUser?: { id: number; username: string } | null
}) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()
  const months = useMemo(() => listPortalBillMonths(), [])
  const [monthValue, setMonthValue] = useState(
    months.some((month) => month.value === props.initialPeriod)
      ? (props.initialPeriod ?? '')
      : (months[0]?.value ?? '')
  )
  const [view, setView] = useState<CostControlView>('user')
  const [user, setUser] = useState<PickedEntity | null>(
    props.initialUser
      ? { id: props.initialUser.id, label: props.initialUser.username }
      : null
  )
  const [channel, setChannel] = useState<PickedEntity | null>(null)
  const [dimensions, setDimensions] = useState<CostControlDimension[]>([
    ...USER_DIMENSIONS,
  ])

  const options = view === 'user' ? USER_DIMENSIONS : CHANNEL_DIMENSIONS
  const selected = options.filter((dimension) => dimensions.includes(dimension))
  const subjectId = view === 'user' ? user?.id : channel?.id
  const costs = useQuery({
    queryKey: ['month-cost-control', monthValue, view, subjectId, selected],
    enabled: monthValue.length > 0 && subjectId != null,
    queryFn: () =>
      getMonthCostControl({
        period: monthValue,
        view,
        userId: user?.id,
        channelId: channel?.id,
        dimensions: selected,
      }),
  })

  const labels: Record<CostControlDimension, string> = {
    group: t('Group'),
    channel: t('Channel'),
    token: t('Token'),
    model: t('Model'),
    user: t('User'),
  }
  const switchView = (next: CostControlView) => {
    if (next === view) return
    setView(next)
    setDimensions(next === 'user' ? [...USER_DIMENSIONS] : [...CHANNEL_DIMENSIONS])
  }

  const columns = [
    ...selected.map((dimension) => ({
      id: dimension,
      header: labels[dimension],
      cell: (row: MonthCostRow) => dimensionText(dimension, row),
    })),
    {
      id: 'cost',
      header: t('Channel cost'),
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      cell: (row: MonthCostRow) => formatQuota(row.cost_quota),
    },
    {
      id: 'charge',
      header: t('Billed amount'),
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      cell: (row: MonthCostRow) => formatQuota(row.quota),
    },
    {
      id: 'count',
      header: t('Requests'),
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      cell: (row: MonthCostRow) => formatNumber(row.count),
    },
  ]

  return (
    <div className='flex w-full flex-col gap-6'>
      <header className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold tracking-tight text-[var(--portal-ink)]'>
            {t('Cost control')}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Group one month of channel cost and the amount billed to users.'
            )}
          </p>
          {view === 'user' && user ? (
            <p className='text-sm text-[var(--portal-ink)]'>
              {t('Viewing {{username}}', { username: user.label })}
            </p>
          ) : null}
          {view === 'channel' && channel ? (
            <p className='text-sm text-[var(--portal-ink)]'>
              {t('Viewing {{username}}', { username: channel.label })}
            </p>
          ) : null}
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
              className='w-40'
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
        </div>
      </header>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          size='sm'
          type='button'
          variant={view === 'user' ? 'default' : 'outline'}
          onClick={() => switchView('user')}
        >
          {t('By user')}
        </Button>
        <Button
          size='sm'
          type='button'
          variant={view === 'channel' ? 'default' : 'outline'}
          onClick={() => switchView('channel')}
        >
          {t('By channel')}
        </Button>
        {view === 'user' ? (
          <EntityPicker
            emptyText={t('No users found')}
            label={t('User')}
            placeholder={t('Search by username or email...')}
            search={searchUserOptions}
            value={user}
            onValueChange={setUser}
          />
        ) : (
          <EntityPicker
            emptyText={t('No channels found')}
            label={t('Channel')}
            placeholder={t('Search by channel name...')}
            search={searchChannelOptions}
            value={channel}
            onValueChange={setChannel}
          />
        )}
      </div>
      <div className='flex flex-wrap items-center gap-4'>
        <span className='text-muted-foreground text-sm'>{t('Group by')}</span>
        {options.map((dimension) => (
          <label key={dimension} className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={dimensions.includes(dimension)}
              onCheckedChange={(checked) => {
                setDimensions((current) =>
                  checked === true
                    ? [...current, dimension]
                    : current.filter((item) => item !== dimension)
                )
              }}
            />
            {labels[dimension]}
          </label>
        ))}
      </div>
      {subjectId == null ? (
        <p className='text-muted-foreground text-sm'>
          {view === 'user'
            ? t("Choose a user to see this month's cost.")
            : t("Choose a channel to see this month's cost.")}
        </p>
      ) : null}
      {costs.isLoading ? <LoadingState /> : null}
      {costs.isError ? (
        <ErrorState
          description={costs.error.message}
          title={t('Could not load cost control')}
          onRetry={() => void costs.refetch()}
        />
      ) : null}
      {costs.isSuccess && costs.data.items.length === 0 ? (
        <EmptyState
          description={t('No cost rows for this month.')}
          title={t('No cost rows')}
        />
      ) : null}
      {costs.isSuccess && costs.data.items.length > 0 ? (
        <>
          {costs.data.truncated ? (
            <p className='text-muted-foreground text-sm'>
              {t('Showing the 500 highest-cost rows.')}
            </p>
          ) : null}
          <StaticDataTable
            columns={columns}
            data={costs.data.items}
            getRowKey={(row, index) =>
              [
                row.user_id,
                row.group_name,
                row.channel_id,
                row.token_id,
                row.model_name,
                index,
              ].join(':')
            }
          />
        </>
      ) : null}
    </div>
  )
}

function dimensionText(dimension: CostControlDimension, row: MonthCostRow) {
  switch (dimension) {
    case 'group':
      return row.group_name || '—'
    case 'channel':
      return row.channel_name
        ? `${row.channel_name} (#${row.channel_id})`
        : `#${row.channel_id}`
    case 'token':
      return row.token_name
        ? `${row.token_name} (#${row.token_id})`
        : `#${row.token_id}`
    case 'model':
      return row.model_name || '—'
    case 'user':
      return row.username
        ? `${row.username} (#${row.user_id})`
        : `#${row.user_id}`
  }
}

async function searchUserOptions(keyword: string): Promise<PickedEntity[]> {
  const result = requireServerSuccess(
    await searchUsers({ keyword, page_size: 8 })
  )
  return (result.data?.items ?? []).map((item) => ({
    id: item.id,
    label: item.username,
  }))
}

async function searchChannelOptions(keyword: string): Promise<PickedEntity[]> {
  const result = requireServerSuccess(
    await searchChannels({ keyword, page_size: 8 })
  )
  return (result.data?.items ?? []).map((item) => ({
    id: item.id,
    label: item.name,
  }))
}

function EntityPicker(props: {
  label: string
  value: PickedEntity | null
  placeholder: string
  emptyText: string
  search: (keyword: string) => Promise<PickedEntity[]>
  onValueChange: (value: PickedEntity) => void
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 300)
  const results = useQuery({
    queryKey: ['cost-control-picker', props.label, debouncedKeyword],
    enabled: open && debouncedKeyword.length > 0,
    queryFn: () => props.search(debouncedKeyword),
  })
  const items = debouncedKeyword.length > 0 ? (results.data ?? []) : []

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setKeyword('')
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
            aria-label={props.label}
            className='max-w-64 min-w-40 justify-between'
          />
        }
      >
        <span className='truncate'>{props.value?.label ?? props.label}</span>
        <ChevronsUpDown className='size-3.5 opacity-50' />
      </PopoverTrigger>
      <PopoverContent align='start' className='w-72 overflow-hidden rounded-xl p-0'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={props.placeholder}
            value={keyword}
            onValueChange={setKeyword}
          />
          <CommandList>
            {debouncedKeyword.length > 0 &&
            !results.isFetching &&
            items.length === 0 ? (
              <CommandEmpty>{props.emptyText}</CommandEmpty>
            ) : null}
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={String(item.id)}
                  onSelect={() => {
                    props.onValueChange(item)
                    setOpen(false)
                    setKeyword('')
                  }}
                >
                  <span className='truncate'>{item.label}</span>
                  <span className='text-muted-foreground ml-auto font-mono text-xs'>
                    #{item.id}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
