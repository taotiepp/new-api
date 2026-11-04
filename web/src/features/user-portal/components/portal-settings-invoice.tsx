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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateUserInvoiceProfile } from '@/features/profile/api'
import {
  invoicePartyReady,
  readInvoiceParty,
} from '@/features/profile/lib/invoice-party'
import type { InvoiceParty } from '@/features/profile/types'
import { handleServerError } from '@/lib/handle-server-error'

const FIELDS: Array<{
  key: keyof InvoiceParty
  label: string
  required: boolean
}> = [
  { key: 'name', label: 'Billing name', required: true },
  { key: 'line1', label: 'Street address', required: true },
  { key: 'line2', label: 'Address line 2', required: false },
  { key: 'city', label: 'City', required: true },
  { key: 'region', label: 'State or region', required: false },
  { key: 'postal_code', label: 'Postal code', required: true },
  { key: 'country', label: 'Country', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'email', label: 'Email', required: true },
]

type PortalSettingsInvoiceProps = {
  userId: number
  party: InvoiceParty
  onSaved: () => void
}

export function PortalSettingsInvoice(props: PortalSettingsInvoiceProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const source = JSON.stringify(readInvoiceParty(props.party))
  const [party, setParty] = useState(() => readInvoiceParty(props.party))

  useEffect(() => {
    setParty(readInvoiceParty(JSON.parse(source) as InvoiceParty))
  }, [source])

  const save = async () => {
    const next = readInvoiceParty(party)
    if (!invoicePartyReady(next)) {
      toast.error(
        t(
          'Name, street address, city, postal code, country, and email are required.'
        )
      )
      return
    }
    setSaving(true)
    try {
      const result = await updateUserInvoiceProfile(props.userId, next)
      if (!result.success) {
        throw new Error(result.message || 'request failed')
      }
      toast.success(t('Billing details saved'))
      props.onSaved()
    } catch (error) {
      handleServerError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='space-y-3 border-t pt-6'>
      <div className='space-y-1'>
        <h3 className='text-sm font-medium'>{t('Billing details')}</h3>
        <p className='text-muted-foreground text-xs'>
          {t('These billing details are printed on the invoice.')}
        </p>
      </div>
      <div className='grid max-w-3xl gap-4 sm:grid-cols-2'>
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className={field.key === 'name' ? 'sm:col-span-2' : undefined}
          >
            <Label htmlFor={`invoice-${field.key}`}>
              {t(field.label)}
              {field.required ? (
                <span className='text-muted-foreground'> *</span>
              ) : null}
            </Label>
            <Input
              id={`invoice-${field.key}`}
              className='mt-2'
              value={party[field.key]}
              autoComplete='off'
              onChange={(event) => {
                const value = event.target.value
                setParty((current) => ({ ...current, [field.key]: value }))
              }}
            />
          </div>
        ))}
      </div>
      <Button
        type='button'
        size='sm'
        disabled={saving}
        onClick={() => {
          void save()
        }}
      >
        {saving ? <Loader2 className='size-3.5 animate-spin' /> : null}
        {t('Save billing details')}
      </Button>
    </section>
  )
}
