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
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { searchUsers } from '@/features/users/api'

import { ModelLimitFields } from './model-limit-fields'
import type {
  UserModelRateLimitInput,
  UserModelRateLimitRow,
} from './user-model-override-api'
import type { ModelRateLimitValue, TokenMode } from './user-model-rate-limit-config'

const overrideSchema = z.object({
  model_name: z.string().max(191),
  rpm: z.number().int().min(-1).max(2147483647),
  tpm: z.number().int().min(-1).max(2147483647),
  token_mode: z.enum(['', 'total', 'input']),
  enabled: z.boolean(),
})

type OverrideFormValues = z.infer<typeof overrideSchema>

const OVERRIDE_FORM_ID = 'user-model-override-form'

type UserModelOverrideDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: UserModelRateLimitInput) => Promise<void> | void
  editRow?: UserModelRateLimitRow | null
  isSubmitting?: boolean
}

export function UserModelOverrideDialog(props: UserModelOverrideDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!props.editRow

  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [selectedUser, setSelectedUser] = useState<{
    id: number
    username: string
  } | null>(null)
  const [userError, setUserError] = useState('')

  const form = useForm<OverrideFormValues>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { model_name: '', rpm: 0, tpm: 0, token_mode: '', enabled: true },
  })

  useEffect(() => {
    if (!props.open) return
    if (props.editRow) {
      form.reset({
        model_name: props.editRow.model_name,
        rpm: props.editRow.rpm,
        tpm: props.editRow.tpm,
        token_mode: props.editRow.token_mode,
        enabled: props.editRow.enabled,
      })
      setSelectedUser({ id: props.editRow.user_id, username: '' })
    } else {
      form.reset({
        model_name: '',
        rpm: 0,
        tpm: 0,
        token_mode: '',
        enabled: true,
      })
      setSelectedUser(null)
    }
    setKeyword('')
    setDebouncedKeyword('')
    setUserError('')
  }, [props.editRow, props.open, form])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const searchEnabled = !isEditMode && debouncedKeyword.length > 0
  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['user-model-override-user-search', debouncedKeyword],
    queryFn: async () => {
      const res = await searchUsers({ keyword: debouncedKeyword, page_size: 10 })
      return res.data?.items ?? []
    },
    enabled: searchEnabled,
  })

  const limitsValue: ModelRateLimitValue = {
    rpm: form.watch('rpm'),
    tpm: form.watch('tpm'),
    token_mode: form.watch('token_mode') as TokenMode,
  }

  const handleSubmit = async (values: OverrideFormValues) => {
    const userId = isEditMode ? (props.editRow?.user_id ?? 0) : (selectedUser?.id ?? 0)
    if (userId <= 0) {
      setUserError(t('Please select a user'))
      return
    }
    await props.onSubmit({
      id: props.editRow?.id,
      user_id: userId,
      model_name: values.model_name.trim(),
      rpm: values.rpm,
      tpm: values.tpm,
      token_mode: values.token_mode as TokenMode,
      enabled: values.enabled,
    })
  }

  let userField: ReactNode
  if (isEditMode) {
    userField = (
      <Input value={`${t('User ID')}: ${props.editRow?.user_id ?? ''}`} disabled />
    )
  } else if (selectedUser) {
    userField = (
      <div className='flex items-center justify-between rounded-md border px-3 py-2'>
        <span className='text-sm'>
          {selectedUser.username || t('User')}
          <span className='text-muted-foreground font-mono'>
            {' '}
            #{selectedUser.id}
          </span>
        </span>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => setSelectedUser(null)}
        >
          {t('Change')}
        </Button>
      </div>
    )
  } else {
    userField = (
      <div className='space-y-2'>
        <Input
          placeholder={t('Search by username or email...')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-invalid={Boolean(userError)}
        />
        {isSearching && (
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <Loader2 className='h-3 w-3 animate-spin' />
            {t('Searching...')}
          </div>
        )}
        {searchEnabled && !isSearching && (
          <div className='max-h-40 overflow-y-auto rounded-md border'>
            {(searchData ?? []).length === 0 ? (
              <p className='text-muted-foreground p-2 text-xs'>
                {t('No users found')}
              </p>
            ) : (
              (searchData ?? []).map((user) => (
                <button
                  key={user.id}
                  type='button'
                  className='hover:bg-accent flex w-full items-center justify-between px-3 py-2 text-left text-sm'
                  onClick={() => {
                    setSelectedUser({ id: user.id, username: user.username })
                    setUserError('')
                  }}
                >
                  <span>{user.username}</span>
                  <span className='text-muted-foreground font-mono text-xs'>
                    #{user.id}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
        {userError && <p className='text-destructive text-xs'>{userError}</p>}
      </div>
    )
  }

  let submitLabel = t('Add')
  if (props.isSubmitting) {
    submitLabel = t('Saving...')
  } else if (isEditMode) {
    submitLabel = t('Update')
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={isEditMode ? t('Edit user model limit') : t('Add user model limit')}
      description={t(
        'Per-user overrides take priority over group and global limits.'
      )}
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
          <Button type='submit' form={OVERRIDE_FORM_ID} disabled={props.isSubmitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={OVERRIDE_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <div className='grid gap-1.5'>
            <FormLabel className='text-xs'>{t('User')}</FormLabel>
            {userField}
          </div>

          <FormField
            control={form.control}
            name='model_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Model Name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('Leave empty for the user default')}
                    {...field}
                    disabled={isEditMode}
                  />
                </FormControl>
                <FormDescription>
                  {t('Empty applies to every model without a specific override.')}
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
              form.setValue('token_mode', next.token_mode, { shouldValidate: true })
            }}
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between rounded-md border p-3'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('Enabled')}</FormLabel>
                  <FormDescription>
                    {t('Disable to keep this override without applying it.')}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
