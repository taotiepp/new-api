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
import { Code2, Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { JsonCodeEditor } from '@/components/json-code-editor'
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

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { UserModelRateLimitEditor } from './user-model-rate-limit-editor'
import { isValidUserModelRateLimitConfigJSON } from './user-model-rate-limit-config'

const createUserModelRateLimitSchema = (t: (key: string) => string) =>
  z.object({
    UserModelRateLimitConfig: z
      .string()
      .optional()
      .refine(isValidUserModelRateLimitConfigJSON, {
        message: t('Invalid JSON format'),
      }),
  })

type UserModelRateLimitFormValues = z.infer<
  ReturnType<typeof createUserModelRateLimitSchema>
>

type UserModelRateLimitSectionProps = {
  defaultValues: UserModelRateLimitFormValues
}

const OPTION_KEY = 'UserModelRateLimitConfig'

export function UserModelRateLimitSection(
  props: UserModelRateLimitSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [useVisualEditor, setUseVisualEditor] = useState(true)

  const schema = createUserModelRateLimitSchema(t)
  const form = useForm<UserModelRateLimitFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const onSubmit = async (values: UserModelRateLimitFormValues) => {
    const next = values.UserModelRateLimitConfig ?? ''
    if (next === (props.defaultValues.UserModelRateLimitConfig ?? '')) {
      return
    }
    await updateOption.mutateAsync({ key: OPTION_KEY, value: next })
  }

  return (
    <SettingsSection title={t('Per-user Model Rate Limits')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save limits'
          />
          <FormField
            control={form.control}
            name={OPTION_KEY}
            render={({ field }) => (
              <FormItem>
                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <FormLabel>{t('Limit rules')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Configure global, per-group and per-model RPM/TPM limits. Per-user overrides are managed separately below.'
                      )}
                    </FormDescription>
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => setUseVisualEditor(!useVisualEditor)}
                  >
                    {useVisualEditor ? (
                      <>
                        <Code2 className='mr-2 h-4 w-4' />
                        {t('JSON Mode')}
                      </>
                    ) : (
                      <>
                        <Palette className='mr-2 h-4 w-4' />
                        {t('Visual Mode')}
                      </>
                    )}
                  </Button>
                </div>
                <FormControl>
                  {useVisualEditor ? (
                    <UserModelRateLimitEditor
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  ) : (
                    <JsonCodeEditor
                      value={field.value || ''}
                      onChange={field.onChange}
                      name={field.name}
                      onBlur={field.onBlur}
                      textareaRef={field.ref}
                      aria-invalid={Boolean(
                        form.formState.errors.UserModelRateLimitConfig
                      )}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
