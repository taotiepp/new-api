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
import { useRef } from 'react'
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

function printInvoiceSheet(sheet: HTMLElement) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }

  const headMarkup = [...document.querySelectorAll('style, link[rel="stylesheet"]')]
    .map((node) => node.outerHTML)
    .join('\n')
  doc.open()
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title>${headMarkup}<style>
      html, body { margin: 0; background: #fff; color: #171717; color-scheme: light; }
      body { padding: 16mm; }
      @page { margin: 12mm; }
    </style></head><body></body></html>`,
  )
  doc.close()

  const clone = sheet.cloneNode(true) as HTMLElement
  clone.style.maxWidth = 'none'
  clone.style.margin = '0'
  clone.style.padding = '0'
  clone.style.background = '#fff'
  clone.style.color = '#171717'
  doc.body.appendChild(clone)

  let printed = false
  const runPrint = () => {
    if (printed) return
    printed = true
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 800)
  }

  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')]
  if (links.length === 0) {
    window.setTimeout(runPrint, 50)
    return
  }
  let remaining = links.length
  const markDone = () => {
    remaining -= 1
    if (remaining <= 0) runPrint()
  }
  for (const link of links) {
    link.addEventListener('load', markDone)
    link.addEventListener('error', markDone)
  }
  window.setTimeout(runPrint, 1200)
}

export function PortalBillInvoiceDialog(props: PortalBillInvoiceDialogProps) {
  const { t } = useTranslation()
  const sheetRef = useRef<HTMLElement>(null)
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

  const handlePrint = () => {
    const sheet = sheetRef.current
    if (sheet) printInvoiceSheet(sheet)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Export invoice')}
      description={t('Print or save this invoice as PDF.')}
      contentClassName='sm:max-w-3xl'
      footer={
        <div className='flex flex-wrap justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleDownloadCsv}
          >
            <Download className='size-3.5' />
            {t('Download CSV')}
          </Button>
          <Button type='button' size='sm' onClick={handlePrint}>
            <Printer className='size-3.5' />
            {t('Print')}
          </Button>
        </div>
      }
    >
      <article
        ref={sheetRef}
        className='portal-invoice-sheet mx-auto w-full max-w-3xl bg-white p-2 text-neutral-900 sm:p-4'
      >
        <header className='flex flex-col gap-6 border-b border-neutral-200 pb-6 sm:flex-row sm:justify-between'>
          <div>
            <p className='text-xs tracking-[0.22em] text-neutral-500 uppercase'>
              {title}
            </p>
            <h2 className='mt-2 text-2xl font-semibold tracking-tight'>
              {issuer}
            </h2>
            <p className='mt-2 text-sm text-neutral-500'>Issued by</p>
          </div>
          <dl className='grid gap-2 text-sm sm:text-right'>
            <div>
              <dt className='text-neutral-500'>Invoice No.</dt>
              <dd className='font-medium tabular-nums'>{invoiceNumber}</dd>
            </div>
            <div>
              <dt className='text-neutral-500'>Invoice Date</dt>
              <dd className='tabular-nums'>{invoiceDate}</dd>
            </div>
            <div>
              <dt className='text-neutral-500'>Billing Period</dt>
              <dd className='tabular-nums'>{props.period}</dd>
            </div>
            <div>
              <dt className='text-neutral-500'>Status</dt>
              <dd>{props.isCurrentMonth ? 'Draft' : 'Paid'}</dd>
            </div>
          </dl>
        </header>

        <section className='grid gap-6 py-6 sm:grid-cols-2'>
          <div>
            <p className='text-xs tracking-wide text-neutral-500 uppercase'>
              Bill To
            </p>
            <p className='mt-2 font-medium'>{billTo}</p>
            {user?.username && user.username !== billTo ? (
              <p className='text-sm text-neutral-500'>{user.username}</p>
            ) : null}
            {user?.email ? (
              <p className='text-sm text-neutral-500'>{user.email}</p>
            ) : null}
          </div>
          <div>
            <p className='text-xs tracking-wide text-neutral-500 uppercase'>
              Payment
            </p>
            <p className='mt-2 text-sm'>Account balance</p>
            <p className='text-sm text-neutral-500'>
              Currency: {catalogCurrency}
            </p>
          </div>
        </section>

        <table className='w-full border-collapse text-sm'>
          <thead>
            <tr className='border-b border-neutral-200 text-left'>
              <th className='py-2 font-medium'>Description</th>
              <th className='py-2 text-right font-medium'>Tokens</th>
              <th className='py-2 text-right font-medium'>Requests</th>
              <th className='py-2 text-right font-medium'>Amount</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((item) => (
              <tr key={item.model_name} className='border-b border-neutral-200'>
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

        <p className='mt-8 text-xs leading-5 text-neutral-500'>
          This is a computer-generated invoice. No signature is required.
        </p>
      </article>
    </Dialog>
  )
}
