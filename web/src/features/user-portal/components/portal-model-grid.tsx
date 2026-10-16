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
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '@/features/pricing/constants'
import { useBillingTime } from '@/features/pricing/hooks/use-billing-time'
import { usePricingFormatters } from '@/features/pricing/hooks/use-pricing-formatters'
import {
  getDynamicDisplayGroupRatio,
  isDynamicPricingModel,
  isUnconfiguredTaskUsageModel,
} from '@/features/pricing/lib/dynamic-price'
import { isTokenBasedModel } from '@/features/pricing/lib/model-helpers'
import type { PricingModel, TokenUnit } from '@/features/pricing/types'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

const TOKEN_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

type PortalModelGridProps = {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  filterKey?: string
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
}

export function PortalModelGrid(props: PortalModelGridProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const pageSize = DEFAULT_PRICING_PAGE_SIZE
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const totalPages = Math.max(1, Math.ceil(props.models.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [props.filterKey])

  const pagedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return props.models.slice(start, start + pageSize)
  }, [currentPage, pageSize, props.models])

  const columns = useMemo<StaticDataTableColumn<PricingModel>[]>(
    () => [
      {
        id: 'model',
        header: t('Model name'),
        cell: (model) => <CatalogModelName model={model} />,
      },
      {
        id: 'context',
        header: t('Context'),
        className: 'w-28',
        cellClassName: 'text-[var(--portal-ink-muted)]',
        cell: (model) => formatCompactTokens(model.context_length) || '—',
      },
      {
        id: 'input',
        header: t('Input'),
        className: 'w-40 text-end',
        cellClassName: 'text-end text-[var(--portal-ink)]',
        cell: (model) => (
          <CatalogPrice
            model={model}
            kind='input'
            tokenUnit={tokenUnit}
            priceRate={priceRate}
            usdExchangeRate={usdExchangeRate}
          />
        ),
      },
      {
        id: 'output',
        header: t('Output'),
        className: 'w-40 text-end',
        cellClassName: 'text-end text-[var(--portal-ink)]',
        cell: (model) => (
          <CatalogPrice
            model={model}
            kind='output'
            tokenUnit={tokenUnit}
            priceRate={priceRate}
            usdExchangeRate={usdExchangeRate}
          />
        ),
      },
    ],
    [priceRate, t, tokenUnit, usdExchangeRate],
  )

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col gap-4'>
      <StaticDataTable
        className='rounded-none border-x-0 border-b-0 border-t border-[var(--portal-hairline)] bg-transparent'
        headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
        columns={columns}
        data={pagedModels}
        getRowKey={(model) => model.id ?? model.model_name}
        renderRow={(model) => (
          <TableRow
            tabIndex={0}
            className='cursor-pointer hover:bg-[var(--portal-card)] focus-visible:bg-[var(--portal-card)] focus-visible:outline-none'
            onClick={() => props.onModelClick(model.model_name || '')}
            onKeyDown={(event) => {
              openModelOnActivate(event, model, props.onModelClick)
            }}
          >
            {columns.map((column) => (
              <TableCell
                key={column.id}
                className={cn(
                  'max-w-full min-w-0 overflow-hidden',
                  typeof column.cellClassName === 'function'
                    ? column.cellClassName(model, 0)
                    : column.cellClassName,
                )}
              >
                {column.cell?.(model, 0)}
              </TableCell>
            ))}
          </TableRow>
        )}
      />

      {totalPages > 1 ? (
        <div className='text-muted-foreground flex flex-col items-center justify-between gap-3 text-sm sm:flex-row'>
          <p>
            {t('Page {{current}} of {{total}}', {
              current: currentPage,
              total: totalPages,
            })}
          </p>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
            >
              {t('Previous page')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage >= totalPages}
            >
              {t('Next page')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CatalogModelName(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const iconKey = props.model.vendor_icon || props.model.icon
  const icon = iconKey ? getLobeIcon(iconKey, 18) : null
  const vendor = props.model.vendor_name?.trim()

  return (
    <span className='flex min-w-0 items-center gap-3'>
      <span
        aria-hidden
        className='flex size-8 shrink-0 items-center justify-center'
      >
        {icon || (
          <span className='text-sm font-medium text-[var(--portal-ink)]'>
            {props.model.model_name?.charAt(0).toUpperCase() || '?'}
          </span>
        )}
      </span>
      <span className='min-w-0'>
        <span className='block truncate font-medium text-[var(--portal-ink)]'>
          {props.model.model_name}
        </span>
        <span className='text-muted-foreground block truncate text-xs font-normal'>
          {vendor || t('Other')}
        </span>
      </span>
    </span>
  )
}

function CatalogPrice(props: {
  model: PricingModel
  kind: 'input' | 'output'
  tokenUnit: TokenUnit
  priceRate: number
  usdExchangeRate: number
}) {
  const { t } = useTranslation()
  const { formatPrice, formatRequestPrice, getDynamicPricingSummary } =
    usePricingFormatters()
  const billingTime = useBillingTime(props.model.billing_expr)
  const unitLabel = props.tokenUnit === 'K' ? '1K' : '1M'

  if (isUnconfiguredTaskUsageModel(props.model)) {
    return props.kind === 'input' ? <span>{t('Dynamic Pricing')}</span> : <Dash />
  }

  if (isDynamicPricingModel(props.model)) {
    const summary = getDynamicPricingSummary(props.model, {
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit: props.tokenUnit,
      showRechargePrice: false,
      priceRate: props.priceRate,
      usdExchangeRate: props.usdExchangeRate,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(props.model, undefined),
    })
    const entries = summary?.primaryEntries.slice(0, 2) ?? []
    const entry = props.kind === 'input' ? entries[0] : entries[1]
    if (!entry) return <Dash />
    return <span>{entry.formattedRange ?? entry.formatted}</span>
  }

  if (!isTokenBasedModel(props.model)) {
    if (props.kind === 'output') return <Dash />
    return (
      <span>
        {formatRequestPrice(
          props.model,
          false,
          props.priceRate,
          props.usdExchangeRate,
        )}
        <span className='text-[var(--portal-ink-muted)] font-normal'>
          {' '}
          / {t('request')}
        </span>
      </span>
    )
  }

  return (
    <span>
      {formatPrice(
        props.model,
        props.kind,
        props.tokenUnit,
        false,
        props.priceRate,
        props.usdExchangeRate,
      )}
      <span className='text-[var(--portal-ink-muted)] font-normal'>
        {' '}
        / {unitLabel}
      </span>
    </span>
  )
}

function Dash() {
  return <span className='text-[var(--portal-ink-muted)] font-normal'>—</span>
}

function openModelOnActivate(
  event: KeyboardEvent<HTMLTableRowElement>,
  model: PricingModel,
  onModelClick: (modelName: string) => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onModelClick(model.model_name || '')
}

function formatCompactTokens(tokens?: number): string {
  if (!tokens || !Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens >= 1_000_000) return `${TOKEN_FORMAT.format(tokens / 1_000_000)}M`
  if (tokens >= 1_000) return `${TOKEN_FORMAT.format(tokens / 1_000)}K`
  return TOKEN_FORMAT.format(tokens)
}
