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
import { Download, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { usePricingCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

import {
  buildPortalBillStatementCsv,
  buildPortalInvoiceDate,
  buildPortalInvoiceNumber,
  type PortalBillStatementItem,
} from '../lib/billing'

type PortalBillInvoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: string
  isCurrentMonth: boolean
  items: PortalBillStatementItem[]
}

const INVOICE_CSV_LABELS = {
  title: 'Invoice',
  disclaimer: 'This is a computer-generated invoice. No signature is required.',
  period: 'Period',
  status: 'Status',
  currency: 'Currency',
  model: 'Model',
  tokens: 'Tokens',
  requests: 'Requests',
  quota: 'Quota',
  total: 'Total',
}

export function PortalBillInvoiceDialog(props: PortalBillInvoiceDialogProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { currency: catalogCurrency, formatQuota } = usePricingCurrency()
  const user = useAuthStore((state) => state.auth.user)
  const issuer = String(status?.system_name ?? '').trim() || 'New API'
  const invoiceNumber = buildPortalInvoiceNumber(props.period, user?.id ?? 0)
  const invoiceDate = buildPortalInvoiceDate(props.period)
  const title = props.isCurrentMonth ? 'PRO FORMA INVOICE' : 'INVOICE'
  const billTo =
    user?.display_name?.trim() || user?.username?.trim() || 'Unknown'
  const totals = props.items.reduce(
    (acc, item) => ({
      quota: acc.quota + (Number(item.quota) || 0),
      count: acc.count + (Number(item.count) || 0),
      tokens: acc.tokens + (Number(item.token_used) || 0),
    }),
    { quota: 0, count: 0, tokens: 0 },
  )

  const handleDownloadCsv = () => {
    const csv = buildPortalBillStatementCsv({
      period: props.period,
      status: props.isCurrentMonth ? 'Draft' : 'Paid',
      currency: catalogCurrency,
      items: props.items,
      labels: INVOICE_CSV_LABELS,
    })
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${invoiceNumber}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Export invoice')}
      description={t(
        'Print this commercial invoice or save it as PDF. This is not a mainland China VAT fapiao.',
      )}
      contentClassName='sm:max-w-3xl'
      footer={
        <div className='portal-invoice-actions flex flex-wrap justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleDownloadCsv}
          >
            <Download className='size-3.5' />
            {t('Download CSV')}
          </Button>
          <Button type='button' size='sm' onClick={() => window.print()}>
            <Printer className='size-3.5' />
            {t('Print')}
          </Button>
        </div>
      }
    >
      <article className='portal-invoice-sheet bg-background text-foreground mx-auto w-full max-w-3xl p-2 font-[Georgia,Times,serif] sm:p-4'>
        <header className='flex flex-col gap-6 border-b pb-6 sm:flex-row sm:justify-between'>
          <div>
            <p className='text-muted-foreground text-xs tracking-[0.22em] uppercase'>
              {title}
            </p>
            <h2 className='mt-2 text-2xl font-semibold tracking-tight'>
              {issuer}
            </h2>
            <p className='text-muted-foreground mt-2 text-sm'>Issued by</p>
          </div>
          <dl className='grid gap-2 text-sm sm:text-right'>
            <div>
              <dt className='text-muted-foreground'>Invoice No.</dt>
              <dd className='font-medium tabular-nums'>{invoiceNumber}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Invoice Date</dt>
              <dd className='tabular-nums'>{invoiceDate}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Billing Period</dt>
              <dd className='tabular-nums'>{props.period}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Status</dt>
              <dd>{props.isCurrentMonth ? 'Draft' : 'Paid'}</dd>
            </div>
          </dl>
        </header>

        <section className='grid gap-6 py-6 sm:grid-cols-2'>
          <div>
            <p className='text-muted-foreground text-xs tracking-wide uppercase'>
              Bill To
            </p>
            <p className='mt-2 font-medium'>{billTo}</p>
            {user?.username && user.username !== billTo ? (
              <p className='text-muted-foreground text-sm'>{user.username}</p>
            ) : null}
            {user?.email ? (
              <p className='text-muted-foreground text-sm'>{user.email}</p>
            ) : null}
          </div>
          <div>
            <p className='text-muted-foreground text-xs tracking-wide uppercase'>
              Payment
            </p>
            <p className='mt-2 text-sm'>Account balance</p>
            <p className='text-muted-foreground text-sm'>
              Currency: {catalogCurrency}
            </p>
          </div>
        </section>

        <table className='w-full border-collapse text-sm'>
          <thead>
            <tr className='border-b text-left'>
              <th className='py-2 font-medium'>Description</th>
              <th className='py-2 text-right font-medium'>Tokens</th>
              <th className='py-2 text-right font-medium'>Requests</th>
              <th className='py-2 text-right font-medium'>Amount</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((item) => (
              <tr key={item.model_name} className='border-b'>
                <td className='py-2'>{item.model_name || 'Unknown model'}</td>
                <td className='py-2 text-right tabular-nums'>
                  {formatNumber(item.token_used, 'en-US')}
                </td>
                <td className='py-2 text-right tabular-nums'>
                  {formatNumber(item.count, 'en-US')}
                </td>
                <td className='py-2 text-right tabular-nums'>
                  {formatQuota(item.quota)} {catalogCurrency}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className='py-3 text-left font-semibold'>Total</th>
              <td className='py-3 text-right font-semibold tabular-nums'>
                {formatNumber(totals.tokens, 'en-US')}
              </td>
              <td className='py-3 text-right font-semibold tabular-nums'>
                {formatNumber(totals.count, 'en-US')}
              </td>
              <td className='py-3 text-right font-semibold tabular-nums'>
                {formatQuota(totals.quota)} {catalogCurrency}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className='text-muted-foreground mt-8 text-xs leading-5'>
          This is a computer-generated commercial invoice. No signature is
          required.
        </p>
      </article>
    </Dialog>
  )
}
