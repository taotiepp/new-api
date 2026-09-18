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
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { ModelLimitFields } from './model-limit-fields'
import type { ModelRateLimitValue, TokenMode } from './user-model-rate-limit-config'

const modelLimitSchema = z.object({
  name: z.string().min(1, 'Model name is required'),
  rpm: z.number().int().min(-1).max(2147483647),
  tpm: z.number().int().min(-1).max(2147483647),
  token_mode: z.enum(['', 'total', 'input']),
})

type ModelLimitFormValues = z.infer<typeof modelLimitSchema>

export type ModelLimitEntryData = {
  name: string
  limits: ModelRateLimitValue
}

const MODEL_LIMIT_FORM_ID = 'user-model-limit-form'

type ModelLimitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: ModelLimitEntryData) => void
  editData?: ModelLimitEntryData | null
}

export function ModelLimitDialog(props: ModelLimitDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!props.editData

  const form = useForm<ModelLimitFormValues>({
    resolver: zodResolver(modelLimitSchema),
    defaultValues: { name: '', rpm: 0, tpm: 0, token_mode: '' },
  })

  useEffect(() => {
    if (!props.open) return
    if (props.editData) {
      form.reset({
        name: props.editData.name,
        rpm: props.editData.limits.rpm,
        tpm: props.editData.limits.tpm,
        token_mode: props.editData.limits.token_mode,
      })
    } else {
      form.reset({ name: '', rpm: 0, tpm: 0, token_mode: '' })
    }
  }, [props.editData, props.open, form])

  const handleSubmit = (values: ModelLimitFormValues) => {
    props.onSave({
      name: values.name,
      limits: {
        rpm: values.rpm,
        tpm: values.tpm,
        token_mode: values.token_mode as TokenMode,
      },
    })
    form.reset()
    props.onOpenChange(false)
  }

  const limitsValue: ModelRateLimitValue = {
    rpm: form.watch('rpm'),
    tpm: form.watch('tpm'),
    token_mode: form.watch('token_mode') as TokenMode,
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={isEditMode ? t('Edit model limit') : t('Add model limit')}
      description={t('Set RPM and TPM limits for a specific model.')}
      contentClassName='sm:max-w-[560px]'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={MODEL_LIMIT_FORM_ID}>
            {isEditMode ? t('Update') : t('Add')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={MODEL_LIMIT_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Model Name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g., gpt-4o, claude-3-5-sonnet')}
                    {...field}
                    disabled={isEditMode}
                  />
                </FormControl>
                <FormDescription>
                  {isEditMode
                    ? t('Model name cannot be changed when editing.')
                    : t('Must match the model name used in requests.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <ModelLimitFields
            value={limitsValue}
            onChange={(next) => {
              form.setValue('rpm', next.rpm, { shouldValidate: true })
              form.setValue('tpm', next.tpm, { shouldValidate: true })
              form.setValue('token_mode', next.token_mode, {
                shouldValidate: true,
              })
            }}
          />
        </form>
      </Form>
    </Dialog>
  )
}
