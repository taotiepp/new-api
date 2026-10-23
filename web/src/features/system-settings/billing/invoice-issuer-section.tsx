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
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  name: z.string().max(80),
  line1: z.string().max(120),
  line2: z.string().max(120),
  city: z.string().max(64),
  region: z.string().max(64),
  postal_code: z.string().max(20),
  country: z.string().max(64),
  phone: z.string().max(32),
  email: z.string().max(80),
})

type Values = z.infer<typeof schema>

const FIELDS = [
  { name: 'name', label: 'Billing name', option: 'invoice_setting.name' },
  { name: 'line1', label: 'Street address', option: 'invoice_setting.line1' },
  { name: 'line2', label: 'Address line 2', option: 'invoice_setting.line2' },
  { name: 'city', label: 'City', option: 'invoice_setting.city' },
  { name: 'region', label: 'State or region', option: 'invoice_setting.region' },
  { name: 'postal_code', label: 'Postal code', option: 'invoice_setting.postal_code' },
  { name: 'country', label: 'Country', option: 'invoice_setting.country' },
  { name: 'phone', label: 'Phone', option: 'invoice_setting.phone' },
  { name: 'email', label: 'Email', option: 'invoice_setting.email' },
] as const

export function InvoiceIssuerSection({
  defaultValues,
}: {
  defaultValues: Values
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues,
  })
  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    const updates = FIELDS.flatMap((field) => {
      if (values[field.name] === defaultValues[field.name]) return []
      return [{ key: field.option, value: values[field.name] }]
    })
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.reset(values)
  }

  return (
    <SettingsSection title={t('Invoice issuer')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save invoice issuer'
          />
          <p className='text-muted-foreground text-sm'>
            {t(
              'These details are printed on invoices as the payee. Street, city, postal code, country, phone, and email match the receipt address block.'
            )}
          </p>
          <div className='grid gap-4 sm:grid-cols-2'>
            {FIELDS.map((field) => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name}
                render={({ field: input }) => (
                  <FormItem className={field.name === 'name' ? 'sm:col-span-2' : undefined}>
                    <FormLabel>{t(field.label)}</FormLabel>
                    <FormControl>
                      <Input {...input} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
