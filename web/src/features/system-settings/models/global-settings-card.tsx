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
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const thinkingBlacklistExample = JSON.stringify(
  ['moonshotai/kimi-k2-thinking', 'kimi-k2-thinking', 're:.*@sha256:.*'],
  null,
  2
)

const chatToResponsesPolicyExample = JSON.stringify(
  {
    enabled: true,
    all_channels: false,
    channel_ids: [1, 2],
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2
)

const chatToResponsesPolicyAllChannelsExample = JSON.stringify(
  {
    enabled: true,
    all_channels: true,
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2
)

const jsonString = (invalidMessage: string) =>
  z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    try {
      JSON.parse(trimmed)
      return true
    } catch {
      return false
    }
  }, invalidMessage)

function createGlobalModelSettingsSchema(t: (key: string) => string) {
  return z.object({
    global: z.object({
      pass_through_request_enabled: z.boolean(),
      thinking_model_blacklist: jsonString(t('Invalid JSON format')),
      chat_completions_to_responses_policy: jsonString(
        t('Invalid JSON format')
      ),
    }),
    general_setting: z
      .object({
        ping_interval_enabled: z.boolean(),
        ping_interval_seconds: z.coerce.number().min(1),
        first_progress_timeout_enabled: z.boolean(),
        first_progress_base_seconds: z.coerce.number().int().min(1),
        first_progress_input_token_divisor: z.coerce.number().int().min(1),
        first_progress_cap_seconds: z.coerce.number().int().min(1),
        first_progress_effort_low_seconds: z.coerce.number().int().min(0),
        first_progress_effort_medium_seconds: z.coerce.number().int().min(0),
        first_progress_effort_high_seconds: z.coerce.number().int().min(0),
      })
      .superRefine((value, ctx) => {
        if (
          value.first_progress_cap_seconds < value.first_progress_base_seconds
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['first_progress_cap_seconds'],
            message: t('The cap must be at least the base seconds.'),
          })
        }
      }),
  })
}

type GlobalModelSettingsFormValues = z.output<
  ReturnType<typeof createGlobalModelSettingsSchema>
>
type GlobalModelSettingsFormInput = z.input<
  ReturnType<typeof createGlobalModelSettingsSchema>
>

type FlatGlobalModelSettings = {
  'global.pass_through_request_enabled': boolean
  'global.thinking_model_blacklist': string
  'global.chat_completions_to_responses_policy': string
  'general_setting.ping_interval_enabled': boolean
  'general_setting.ping_interval_seconds': number
  'general_setting.first_progress_timeout_enabled': boolean
  'general_setting.first_progress_base_seconds': number
  'general_setting.first_progress_input_token_divisor': number
  'general_setting.first_progress_cap_seconds': number
  'general_setting.first_progress_effort_low_seconds': number
  'general_setting.first_progress_effort_medium_seconds': number
  'general_setting.first_progress_effort_high_seconds': number
}

const flattenGlobalValues = (
  values: GlobalModelSettingsFormValues
): FlatGlobalModelSettings => ({
  'global.pass_through_request_enabled':
    values.global.pass_through_request_enabled,
  'global.thinking_model_blacklist': normalizeJsonText(
    values.global.thinking_model_blacklist,
    '[]'
  ),
  'global.chat_completions_to_responses_policy': normalizeJsonText(
    values.global.chat_completions_to_responses_policy,
    '{}'
  ),
  'general_setting.ping_interval_enabled':
    values.general_setting.ping_interval_enabled,
  'general_setting.ping_interval_seconds':
    values.general_setting.ping_interval_seconds,
  'general_setting.first_progress_timeout_enabled':
    values.general_setting.first_progress_timeout_enabled,
  'general_setting.first_progress_base_seconds':
    values.general_setting.first_progress_base_seconds,
  'general_setting.first_progress_input_token_divisor':
    values.general_setting.first_progress_input_token_divisor,
  'general_setting.first_progress_cap_seconds':
    values.general_setting.first_progress_cap_seconds,
  'general_setting.first_progress_effort_low_seconds':
    values.general_setting.first_progress_effort_low_seconds,
  'general_setting.first_progress_effort_medium_seconds':
    values.general_setting.first_progress_effort_medium_seconds,
  'general_setting.first_progress_effort_high_seconds':
    values.general_setting.first_progress_effort_high_seconds,
})

function normalizeJsonText(value: string, fallback: string) {
  const trimmed = (value ?? '').toString().trim()
  return trimmed ? trimmed : fallback
}

const firstProgressEnabledKey =
  'general_setting.first_progress_timeout_enabled' as const
const firstProgressBaseKey =
  'general_setting.first_progress_base_seconds' as const
const firstProgressCapKey =
  'general_setting.first_progress_cap_seconds' as const

function orderFirstProgressUpdates(
  updates: Array<
    [string, FlatGlobalModelSettings[keyof FlatGlobalModelSettings]]
  >,
  current: FlatGlobalModelSettings,
  next: FlatGlobalModelSettings
) {
  const rest = updates.filter(
    ([key]) =>
      key !== firstProgressEnabledKey &&
      key !== firstProgressBaseKey &&
      key !== firstProgressCapKey
  )
  const enabled = updates.find(([key]) => key === firstProgressEnabledKey)
  const base = updates.find(([key]) => key === firstProgressBaseKey)
  const cap = updates.find(([key]) => key === firstProgressCapKey)
  const limits: typeof updates = []
  if (
    base &&
    cap &&
    next[firstProgressCapKey] >= current[firstProgressBaseKey]
  ) {
    limits.push(cap, base)
  } else {
    if (base) limits.push(base)
    if (cap) limits.push(cap)
  }
  if (enabled?.[1] === false) {
    return [enabled, ...limits, ...rest]
  }
  return [...rest, ...limits, ...(enabled ? [enabled] : [])]
}

type GlobalSettingsCardProps = {
  defaultValues: GlobalModelSettingsFormValues
}

export function GlobalSettingsCard({ defaultValues }: GlobalSettingsCardProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const schema = useMemo(() => createGlobalModelSettingsSchema(t), [t])

  const form = useForm<
    GlobalModelSettingsFormInput,
    unknown,
    GlobalModelSettingsFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as GlobalModelSettingsFormInput,
  })

  useEffect(() => {
    form.reset(defaultValues as GlobalModelSettingsFormInput)
  }, [defaultValues, form])

  const pingEnabled = form.watch('general_setting.ping_interval_enabled')
  const firstProgressEnabled = form.watch(
    'general_setting.first_progress_timeout_enabled'
  )

  const onSubmit = async (values: GlobalModelSettingsFormValues) => {
    const flattenedDefaults = flattenGlobalValues(defaultValues)
    const flattenedValues = flattenGlobalValues(values)
    const updates = orderFirstProgressUpdates(
      Object.entries(flattenedValues).filter(
        ([key, value]) =>
          value !== flattenedDefaults[key as keyof FlatGlobalModelSettings]
      ),
      flattenedDefaults,
      flattenedValues
    )

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({
        key,
        value,
      })
    }
  }

  return (
    <SettingsSection title={t('Global Model Configuration')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='global.pass_through_request_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Request Passthrough')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Forward requests directly to upstream providers without any post-processing.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='global.thinking_model_blacklist'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Models that skip thinking suffix processing')}
                </FormLabel>
                <FormControl>
                  <JsonCodeEditor
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    name={field.name}
                    onBlur={field.onBlur}
                    textareaRef={field.ref}
                    placeholder={`${t('Example:')}\n${thinkingBlacklistExample}`}
                    heightClassName='h-32 min-h-32 max-h-32'
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Models listed here skip automatic -thinking / -nothinking suffix handling. Matched names are also exempt from @-modifier parsing and 400 validation. Prefix an entry with re: to match the full model name as a Go regular expression, for example re:.*@sha256:.*'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              <h3 className='text-base font-semibold'>
                {t('ChatCompletions -> Responses Compatibility')}
              </h3>
              <StatusBadge
                label={t('Preview')}
                variant='neutral'
                copyable={false}
              />
            </div>

            <Alert>
              <AlertTitle>{t('Warning')}</AlertTitle>
              <AlertDescription>
                {t(
                  'This feature is experimental. Configuration format and behavior may change.'
                )}
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name='global.chat_completions_to_responses_policy'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Policy JSON')}</FormLabel>
                  <FormControl>
                    <JsonCodeEditor
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      name={field.name}
                      onBlur={field.onBlur}
                      textareaRef={field.ref}
                      placeholder={`${t('Example (specific channels):')}\n${chatToResponsesPolicyExample}\n\n${t('Example (all channels):')}\n${chatToResponsesPolicyAllChannelsExample}`}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Empty value will be saved as {}.')}
                  </FormDescription>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        form.setValue(
                          'global.chat_completions_to_responses_policy',
                          chatToResponsesPolicyExample,
                          { shouldDirty: true }
                        )
                      }
                    >
                      {t('Fill example (specific channels)')}
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        form.setValue(
                          'global.chat_completions_to_responses_policy',
                          chatToResponsesPolicyAllChannelsExample,
                          { shouldDirty: true }
                        )
                      }
                    >
                      {t('Fill example (all channels)')}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <FormField
            control={form.control}
            name='general_setting.ping_interval_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Keep-alive Ping')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Periodically send ping frames to keep streaming connections active.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.ping_interval_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Ping Interval (seconds)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    disabled={!pingEnabled}
                    className='w-24'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Recommended to keep this high to avoid upstream throttling.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

          <FormField
            control={form.control}
            name='general_setting.first_progress_timeout_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('First-progress timeout')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Before any text, reasoning, or tool output, fail the stream after the minimum of the cap and base plus input tokens divided by the divisor plus reasoning-effort seconds. Retry only if the client has not received any response bytes.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.first_progress_base_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Base seconds')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    disabled={!firstProgressEnabled}
                    className='w-28'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t('Starting wait for every streaming request.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.first_progress_input_token_divisor'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Input token divisor')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    disabled={!firstProgressEnabled}
                    className='w-28'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Add one second for each group of this many estimated input tokens.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.first_progress_cap_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Maximum seconds')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    disabled={!firstProgressEnabled}
                    className='w-28'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'The calculated wait cannot exceed this value or the streaming idle timeout.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.first_progress_effort_low_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Low reasoning-effort seconds')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    disabled={!firstProgressEnabled}
                    className='w-28'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Extra seconds for low, medium, and high reasoning effort. xhigh and max use the high value.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.first_progress_effort_medium_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Medium reasoning-effort seconds')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    disabled={!firstProgressEnabled}
                    className='w-28'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.first_progress_effort_high_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('High reasoning-effort seconds')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    disabled={!firstProgressEnabled}
                    className='w-28'
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
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
