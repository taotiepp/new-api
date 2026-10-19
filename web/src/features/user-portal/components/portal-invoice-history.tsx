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

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import type { UserInvoice } from '@/features/dashboard/api'
import dayjs from '@/lib/dayjs'

type PortalInvoiceHistoryProps = {
  loading: boolean
  error: boolean
  invoices: UserInvoice[]
  currency: string
  formatQuota: (quota: number) => string
  onRetry: () => void
  onOpen: (invoice: UserInvoice) => void
}

export function PortalInvoiceHistory(props: PortalInvoiceHistoryProps) {
  const { t } = useTranslation()
  let body = (
    <ul className='mt-4 divide-y divide-[var(--portal-hairline)]'>
      {props.invoices.map((invoice) => (
        <li
          key={invoice.id}
          className='flex flex-wrap items-center justify-between gap-3 py-3'
        >
          <div>
            <p className='font-medium tabular-nums'>{invoice.number}</p>
            <p className='text-muted-foreground text-sm tabular-nums'>
              {dayjs.unix(invoice.created_at).format('YYYY-MM-DD')}
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <p className='tabular-nums'>
              {props.formatQuota(invoice.quota)} {props.currency}
            </p>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => props.onOpen(invoice)}
            >
              {t('View invoice')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
  if (props.error) {
    body = (
      <ErrorState
        className='mt-4 min-h-32'
        title={t('Failed to load bills')}
        onRetry={props.onRetry}
      />
    )
  } else if (props.invoices.length === 0) {
    body = (
      <p className='text-muted-foreground mt-4 text-sm'>
        {props.loading ? t('Loading...') : t('No invoices for this period.')}
      </p>
    )
  }

  return (
    <section className='border-t border-[var(--portal-hairline)] pt-5'>
      <h2 className='text-sm font-semibold text-[var(--portal-ink)]'>
        {t('Invoice history')}
      </h2>
      <p className='text-muted-foreground mt-1 text-sm'>
        {t('Each invoice covers only usage since the previous one.')}
      </p>
      {body}
    </section>
  )
}
