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
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { usePricingCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'

import type { PortalKeyUsage } from '../lib/billing'

type PortalKeyUsageTableProps = {
  rows: PortalKeyUsage[]
  loading: boolean
  error: boolean
  onRetry: () => void
}

export function PortalKeyUsageTable(props: PortalKeyUsageTableProps) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()

  let body = (
    <StaticDataTable
      columns={[
        {
          id: 'key',
          header: t('API key'),
          cell: (row) => row.name,
        },
        {
          id: 'quota',
          header: t('Consumption'),
          cellClassName: 'text-right tabular-nums',
          cell: (row) => formatQuota(row.quota),
        },
        {
          id: 'count',
          header: t('API request count'),
          cellClassName: 'text-right tabular-nums',
          cell: (row) => formatNumber(row.count),
        },
        {
          id: 'tokens',
          header: t('Tokens'),
          cellClassName: 'text-right tabular-nums',
          cell: (row) => formatNumber(row.tokens),
        },
      ]}
      data={props.rows}
      getRowKey={(row) => row.tokenId}
      emptyContent={t('No data')}
    />
  )
  if (props.loading) {
    body = <Skeleton className='h-24 w-full' />
  } else if (props.error) {
    body = (
      <ErrorState
        className='min-h-48'
        title={t('Failed to load key usage')}
        onRetry={props.onRetry}
      />
    )
  }

  return (
    <section className='flex flex-col gap-3' aria-busy={props.loading}>
      <h2 className='text-lg font-semibold tracking-tight text-[var(--portal-ink)]'>
        {t('Usage by key')}
      </h2>
      {body}
    </section>
  )
}
