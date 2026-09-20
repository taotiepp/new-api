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
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ModelDiscountRow } from '@/lib/discount'

export type DiscountEditorProps = {
  defaultDiscount: number | null
  onDefaultDiscountChange: (value: number | null) => void
  allowEmptyDefault?: boolean
  defaultLabel: string
  defaultDescription: string
  modelLabel?: string
  emptyModelsHint?: string
  modelDiscounts: ModelDiscountRow[]
  onModelDiscountsChange: (rows: ModelDiscountRow[]) => void
}

function parseDiscountInput(
  raw: string,
  allowEmpty: boolean
): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return allowEmpty ? null : undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

export function DiscountEditor(props: DiscountEditorProps) {
  const { t } = useTranslation()
  const allowEmpty = props.allowEmptyDefault === true

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='default-discount'>{props.defaultLabel}</Label>
        <Input
          id='default-discount'
          type='number'
          min={0}
          step='0.01'
          inputMode='decimal'
          value={props.defaultDiscount ?? ''}
          placeholder={allowEmpty ? t('Unset') : '1'}
          onChange={(event) => {
            const next = parseDiscountInput(event.target.value, allowEmpty)
            if (next === undefined) return
            props.onDefaultDiscountChange(next)
          }}
        />
        <p className='text-muted-foreground text-xs'>
          {props.defaultDescription}
        </p>
      </div>

      <div className='space-y-2'>
        <div className='flex items-center justify-between gap-2'>
          <Label>{props.modelLabel ?? t('Model discounts')}</Label>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              props.onModelDiscountsChange([
                ...props.modelDiscounts,
                {
                  id: `discount-new-${Date.now()}`,
                  model: '',
                  discount: 1,
                },
              ])
            }
          >
            <Plus className='mr-1 h-4 w-4' aria-hidden='true' />
            {t('Add model discount')}
          </Button>
        </div>
        {props.modelDiscounts.length === 0 ? (
          <p className='text-muted-foreground text-xs'>
            {props.emptyModelsHint ??
              t('No per-model overrides. The default discount applies.')}
          </p>
        ) : (
          <div className='space-y-2'>
            {props.modelDiscounts.map((row, index) => (
              <div key={row.id ?? `model-discount-${row.model}`} className='flex gap-2'>
                <Input
                  value={row.model}
                  placeholder={t('Model name')}
                  aria-label={t('Model name')}
                  onChange={(event) => {
                    const next = props.modelDiscounts.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, model: event.target.value }
                        : item
                    )
                    props.onModelDiscountsChange(next)
                  }}
                />
                <Input
                  type='number'
                  min={0}
                  step='0.01'
                  inputMode='decimal'
                  className='w-28'
                  value={row.discount}
                  aria-label={t('Discount')}
                  onChange={(event) => {
                    const parsed = parseDiscountInput(event.target.value, false)
                    if (parsed == null) return
                    const next = props.modelDiscounts.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, discount: parsed }
                        : item
                    )
                    props.onModelDiscountsChange(next)
                  }}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={t('Remove')}
                  onClick={() =>
                    props.onModelDiscountsChange(
                      props.modelDiscounts.filter(
                        (_item, itemIndex) => itemIndex !== index
                      )
                    )
                  }
                >
                  <Trash2 className='h-4 w-4' aria-hidden='true' />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className='text-muted-foreground text-xs'>
          {t('1 = list price, 0.8 = 20% off, 0 = free.')}
        </p>
      </div>
    </div>
  )
}
