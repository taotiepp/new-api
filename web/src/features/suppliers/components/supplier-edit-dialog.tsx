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

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { SUPPLIER_PROFILE_FIELDS } from '../lib/fields'
import type { Supplier, SupplierProfileInput } from '../types'

type SupplierEditDialogProps = {
  supplier: Supplier | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    supplier: Supplier,
    body: { discount: number | null; profile: SupplierProfileInput }
  ) => void
}

export function SupplierEditDialog(props: SupplierEditDialogProps) {
  const { t } = useTranslation()
  const supplier = props.supplier

  return (
    <Dialog open={supplier != null} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Edit supplier')}</DialogTitle>
          <DialogDescription>
            {supplier
              ? t('Update commercial details for {{name}}.', {
                  name: supplier.name,
                })
              : t(
                  'Commercial details for each channel. Models and redirects stay in the legacy console.'
                )}
          </DialogDescription>
        </DialogHeader>
        {supplier ? (
          <SupplierEditForm
            key={supplier.id}
            saving={props.saving}
            supplier={supplier}
            onSave={props.onSave}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SupplierEditForm(props: {
  supplier: Supplier
  saving: boolean
  onSave: SupplierEditDialogProps['onSave']
}) {
  const { t } = useTranslation()
  const supplier = props.supplier
  const [discount, setDiscount] = useState(
    supplier.discount == null ? '' : String(supplier.discount)
  )
  const [fields, setFields] = useState(() => initialFields(supplier))
  const [error, setError] = useState('')
  const groupDiscount =
    supplier.groups.length === 0
      ? t('Unset')
      : supplier.groups
          .map((group) =>
            group.discount == null
              ? `${group.name} ${t('Unset')}`
              : `${group.name} ${group.discount}`
          )
          .join(', ')

  return (
    <form
      className='space-y-4'
      onSubmit={(event) => {
        event.preventDefault()
        const parsed = parseDraft(discount, fields)
        if (!parsed.ok) {
          setError(t(parsed.message))
          return
        }
        props.onSave(supplier, parsed.body)
      }}
    >
      <div className='space-y-1'>
        <p className='text-sm font-medium'>{t('Group discount')}</p>
        <p className='text-muted-foreground text-sm'>{groupDiscount}</p>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Group discount comes from the group ratio and is changed in system settings.'
          )}
        </p>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='supplier-discount'>{t('Channel discount')}</Label>
        <Input
          id='supplier-discount'
          inputMode='decimal'
          min={0}
          step='0.01'
          type='number'
          value={discount}
          onChange={(event) => {
            setDiscount(event.target.value)
            setError('')
          }}
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'Channel discount is the cost multiplier for this channel. Leave it empty to unset it.'
          )}
        </p>
      </div>
      {SUPPLIER_PROFILE_FIELDS.map((field) => (
        <div className='space-y-2' key={field.key}>
          <Label htmlFor={`supplier-${field.key}`}>{t(field.labelKey)}</Label>
          <Input
            id={`supplier-${field.key}`}
            inputMode={field.kind === 'count' ? 'numeric' : 'text'}
            maxLength={field.maxLength}
            min={field.kind === 'count' ? 0 : undefined}
            step={field.kind === 'count' ? 1 : undefined}
            type={field.kind === 'count' ? 'number' : 'text'}
            value={fields[field.key]}
            onChange={(event) => {
              const value = event.target.value
              setFields((current) => ({ ...current, [field.key]: value }))
              setError('')
            }}
          />
        </div>
      ))}
      {error ? (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button disabled={props.saving} type='submit'>
          {t('Save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function initialFields(supplier: Supplier): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of SUPPLIER_PROFILE_FIELDS) {
    const raw = supplier.profile[field.key]
    values[field.key] = raw == null ? '' : String(raw)
  }
  return values
}

function parseDraft(discountRaw: string, fields: Record<string, string>):
  | {
      ok: true
      body: { discount: number | null; profile: SupplierProfileInput }
    }
  | { ok: false; message: string } {
  const discount = parseOptionalNumber(discountRaw)
  if (discount === undefined || (discount != null && discount < 0)) {
    return { ok: false, message: 'Enter a discount of 0 or more' }
  }
  const tpm = parseOptionalCount(fields.tpm ?? '')
  const rpm = parseOptionalCount(fields.rpm ?? '')
  if (tpm === undefined || rpm === undefined) {
    return { ok: false, message: 'Enter a whole number for TPM or RPM' }
  }
  return {
    ok: true,
    body: {
      discount,
      profile: {
        tpm,
        rpm,
        payment_method: emptyToNull(fields.payment_method ?? ''),
        company_entity: emptyToNull(fields.company_entity ?? ''),
      },
    },
  }
}

function parseOptionalNumber(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function parseOptionalCount(raw: string): number | null | undefined {
  const parsed = parseOptionalNumber(raw)
  if (parsed == null) return parsed
  if (!Number.isInteger(parsed) || parsed < 0) return undefined
  return parsed
}

function emptyToNull(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  return trimmed
}
