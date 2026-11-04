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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createMonthAdjustment,
  type UserMonthAdjustment,
} from '@/features/dashboard/api'
import { quotaFromCurrencyAmount, usePricingCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

type PortalBillAdminProps = {
  userId: number
  period: string
  adjustments: UserMonthAdjustment[]
  formatQuota: (quota: number) => string
  onChanged: () => void
}

export function PortalBillAdmin(props: PortalBillAdminProps) {
  const { t } = useTranslation()
  const { quotaPerUnit, exchangeRate } = usePricingCurrency()
  const [bucket, setBucket] = useState<'regular' | 'test'>('regular')
  const [direction, setDirection] = useState<'credit' | 'charge'>('credit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const applyAdjustment = async () => {
    const units = quotaFromCurrencyAmount(
      Number.parseFloat(amount),
      quotaPerUnit,
      exchangeRate
    )
    if (!props.period || props.userId <= 0 || units <= 0) {
      toast.error(t('Enter an amount'))
      return
    }
    const trimmed = note.trim()
    if (!trimmed) {
      toast.error(t('Adjustment note'))
      return
    }
    setSaving(true)
    try {
      requireServerSuccess(
        await createMonthAdjustment({
          user_id: props.userId,
          period: props.period,
          bucket,
          quota: direction === 'charge' ? -units : units,
          note: trimmed,
        })
      )
      setAmount('')
      setNote('')
      toast.success(t('Adjustment saved'))
      props.onChanged()
    } catch (error) {
      handleServerError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='flex flex-col gap-8 border-t border-[var(--portal-hairline)] pt-6'>
      <section>
        <h2 className='text-base font-semibold text-[var(--portal-ink)]'>
          {t('Monthly adjustment')}
        </h2>
        <p className='text-muted-foreground mt-1 max-w-2xl text-sm'>
          {t(
            'Test credit is a voucher. It is deducted automatically when an invoice is issued.'
          )}
        </p>
        <div className='mt-4 grid max-w-3xl gap-4 sm:grid-cols-2'>
          <div>
            <Label htmlFor='bill-adjustment-bucket'>{t('Balance')}</Label>
            <Select
              items={[
                { value: 'regular', label: t('Regular balance') },
                { value: 'test', label: t('Test credit') },
              ]}
              value={bucket}
              onValueChange={(value) => {
                if (value === 'regular' || value === 'test') setBucket(value)
              }}
            >
              <SelectTrigger id='bill-adjustment-bucket' className='mt-2 w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='regular'>{t('Regular balance')}</SelectItem>
                  <SelectItem value='test'>{t('Test credit')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor='bill-adjustment-direction'>{t('Direction')}</Label>
            <Select
              items={[
                { value: 'credit', label: t('Add credit') },
                { value: 'charge', label: t('Deduct') },
              ]}
              value={direction}
              onValueChange={(value) => {
                if (value === 'credit' || value === 'charge') setDirection(value)
              }}
            >
              <SelectTrigger
                id='bill-adjustment-direction'
                className='mt-2 w-full'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='credit'>{t('Add credit')}</SelectItem>
                  <SelectItem value='charge'>{t('Deduct')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor='bill-adjustment-amount'>{t('Amount')}</Label>
            <Input
              id='bill-adjustment-amount'
              className='mt-2'
              inputMode='decimal'
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className='sm:col-span-2'>
            <Label htmlFor='bill-adjustment-note'>{t('Adjustment note')}</Label>
            <Textarea
              id='bill-adjustment-note'
              className='mt-2'
              maxLength={80}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <Button
          type='button'
          className='mt-4'
          size='sm'
          disabled={saving || props.userId <= 0}
          onClick={() => {
            void applyAdjustment()
          }}
        >
          {t('Apply adjustment')}
        </Button>
        {props.adjustments.length > 0 ? (
          <ul className='mt-4 flex max-w-3xl flex-col gap-2 text-sm'>
            {props.adjustments.map((row) => (
              <li
                key={row.id}
                className='flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--portal-hairline)] py-2'
              >
                <span>
                  {row.bucket === 'test' ? t('Test credit') : t('Regular balance')}
                  <span className='text-muted-foreground'> · {row.note}</span>
                </span>
                <span className='tabular-nums'>
                  {row.quota > 0 ? '+' : ''}
                  {props.formatQuota(row.quota)}
                  <span className='text-muted-foreground ml-2'>
                    {dayjs.unix(row.created_at).format('YYYY-MM-DD')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
