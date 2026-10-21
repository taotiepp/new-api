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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
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
import { Switch } from '@/components/ui/switch'
import {
  createApiKey,
  fetchTokenKey,
  getTokenAutoGroups,
  updateApiKey,
} from '@/features/keys/api'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from '@/features/keys/components/api-key-group-combobox'
import { AutoGroupOrderEditor } from '@/features/keys/components/auto-group-order-editor'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/features/keys/constants'
import {
  getApiKeyFormDefaultValues,
  transformApiKeyToFormDefaults,
  transformFormDataToPayload,
} from '@/features/keys/lib'
import type { ApiKey } from '@/features/keys/types'
import { useStatus } from '@/hooks/use-status'
import { getUserGroups } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

type PortalKeysCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey?: ApiKey | null
}

export function PortalKeysCreateDialog(props: PortalKeysCreateDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { status } = useStatus()
  const defaultUseAutoGroup = status?.default_use_auto_group === true
  const formDefaults = getApiKeyFormDefaultValues(defaultUseAutoGroup)
  const [name, setName] = useState('')
  const [group, setGroup] = useState(formDefaults.group ?? '')
  const [autoGroupsMode, setAutoGroupsMode] = useState<'inherit' | 'custom'>(
    formDefaults.auto_groups_mode
  )
  const [autoGroups, setAutoGroups] = useState<string[]>(
    formDefaults.auto_groups
  )
  const [crossGroupRetry, setCrossGroupRetry] = useState(
    formDefaults.cross_group_retry === true
  )
  const [clearEncryptedContent, setClearEncryptedContent] = useState(
    formDefaults.clear_encrypted_content === true
  )
  const [unlimited, setUnlimited] = useState(true)
  const [quotaDollars, setQuotaDollars] = useState('10')
  const [submitting, setSubmitting] = useState(false)
  const [createdKey, setCreatedKey] = useState('')
  const editingKey = props.apiKey ?? null
  const initializedFor = useRef<string | null>(null)

  const groupsQuery = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    enabled: props.open,
    staleTime: 0,
  })
  const autoGroupsQuery = useQuery({
    queryKey: ['token-auto-groups'],
    queryFn: async () => requireServerSuccess(await getTokenAutoGroups()),
    enabled: props.open,
    staleTime: 0,
  })

  const groups = useMemo<ApiKeyGroupOption[]>(
    () =>
      Object.entries(groupsQuery.data?.data || {}).map(([key, info]) => ({
        value: key,
        label: key,
        desc: info.desc || key,
        ratio: info.ratio,
        virtual: info.virtual,
      })),
    [groupsQuery.data]
  )
  const availableAutoGroupNames = useMemo(
    () =>
      groups
        .filter((item) => item.value !== 'auto' && !item.virtual)
        .map((item) => item.value),
    [groups]
  )
  const globalAutoGroupOptions = useMemo(() => {
    const available = new Set(availableAutoGroupNames)
    const groupsByValue = new Map(groups.map((item) => [item.value, item]))
    return (autoGroupsQuery.data?.data?.groups || []).flatMap((item) => {
      if (!available.has(item)) return []
      const option = groupsByValue.get(item)
      return option ? [option] : []
    })
  }, [autoGroupsQuery.data, availableAutoGroupNames, groups])
  const maxAutoGroups =
    Number.isInteger(autoGroupsQuery.data?.data?.max_count) &&
    Number(autoGroupsQuery.data?.data?.max_count) > 0
      ? Number(autoGroupsQuery.data?.data?.max_count)
      : 5

  useEffect(() => {
    if (!props.open || groups.length === 0) return
    if (editingKey && initializedFor.current !== `edit:${editingKey.id}`) {
      return
    }
    if (group && groups.some((item) => item.value === group)) return
    const fallback =
      defaultUseAutoGroup && groups.some((item) => item.value === 'auto')
        ? 'auto'
        : (groups.find((item) => item.value === 'default')?.value ??
          groups[0]?.value ??
          '')
    setGroup(fallback)
    setCrossGroupRetry(fallback === 'auto')
  }, [defaultUseAutoGroup, editingKey, group, groups, props.open])

  useEffect(() => {
    if (!props.open) {
      initializedFor.current = null
      return
    }
    if (!editingKey) return
    if (!groupsQuery.isSuccess || !autoGroupsQuery.isSuccess) return
    const token = `edit:${editingKey.id}`
    if (initializedFor.current === token) return
    initializedFor.current = token
    const defaults = transformApiKeyToFormDefaults(
      editingKey,
      availableAutoGroupNames,
      maxAutoGroups
    )
    setName(editingKey.name)
    setGroup(defaults.group ?? '')
    setAutoGroupsMode(defaults.auto_groups_mode)
    setAutoGroups(defaults.auto_groups)
    setCrossGroupRetry(defaults.cross_group_retry === true)
    setClearEncryptedContent(defaults.clear_encrypted_content === true)
    setUnlimited(defaults.unlimited_quota)
    setQuotaDollars(String(defaults.remain_quota_dollars ?? 0))
  }, [
    autoGroupsQuery.isSuccess,
    availableAutoGroupNames,
    editingKey,
    groupsQuery.isSuccess,
    maxAutoGroups,
    props.open,
  ])

  const reset = () => {
    const nextDefaults = getApiKeyFormDefaultValues(defaultUseAutoGroup)
    setName('')
    setGroup(nextDefaults.group ?? '')
    setAutoGroupsMode(nextDefaults.auto_groups_mode)
    setAutoGroups(nextDefaults.auto_groups)
    setCrossGroupRetry(nextDefaults.cross_group_retry === true)
    setClearEncryptedContent(nextDefaults.clear_encrypted_content === true)
    setUnlimited(true)
    setQuotaDollars('10')
    setSubmitting(false)
    setCreatedKey('')
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) reset()
    props.onOpenChange(open)
  }

  const handleSubmit = async () => {
    const trimmed = editingKey ? editingKey.name : name.trim()
    if (!trimmed) {
      toast.error(t('Please enter a name'))
      return
    }
    const parsedQuota = Number(quotaDollars)
    if (!unlimited && (!Number.isFinite(parsedQuota) || parsedQuota < 0)) {
      toast.error(t('Quota must be zero or greater'))
      return
    }

    const base = editingKey
      ? transformApiKeyToFormDefaults(
          editingKey,
          availableAutoGroupNames,
          maxAutoGroups
        )
      : getApiKeyFormDefaultValues(defaultUseAutoGroup)
    const payload = transformFormDataToPayload({
      ...base,
      name: trimmed,
      group,
      auto_groups_mode: autoGroupsMode,
      auto_groups: autoGroups,
      cross_group_retry: crossGroupRetry,
      clear_encrypted_content: clearEncryptedContent,
      unlimited_quota: unlimited,
      remain_quota_dollars: unlimited
        ? (base.remain_quota_dollars ?? 10)
        : parsedQuota,
    })

    setSubmitting(true)
    try {
      if (editingKey) {
        requireServerSuccess(
          await updateApiKey({
            ...payload,
            id: editingKey.id,
          })
        )
        await queryClient.invalidateQueries({
          queryKey: ['user-portal', 'keys'],
        })
        toast.success(t(SUCCESS_MESSAGES.API_KEY_UPDATED))
        handleOpenChange(false)
        return
      }

      const created = requireServerSuccess(await createApiKey(payload))
      const id = created.data?.id
      let fullKey = ''
      if (id != null) {
        const secret = requireServerSuccess(await fetchTokenKey(id))
        const raw = secret.data?.key ?? ''
        fullKey = raw.startsWith('sk-') ? raw : `sk-${raw}`
      }
      await queryClient.invalidateQueries({ queryKey: ['user-portal', 'keys'] })
      toast.success(t(SUCCESS_MESSAGES.API_KEY_CREATED))
      setCreatedKey(fullKey)
    } catch (error) {
      handleServerError(
        error,
        t(
          editingKey
            ? ERROR_MESSAGES.UPDATE_FAILED
            : ERROR_MESSAGES.CREATE_FAILED
        )
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>{t(SUCCESS_MESSAGES.API_KEY_CREATED)}</DialogTitle>
              <DialogDescription>
                {t('Copy this key now. It will not be shown in full again.')}
              </DialogDescription>
            </DialogHeader>
            <div className='flex items-start gap-2'>
              <pre className='max-h-40 flex-1 overflow-auto rounded-[var(--portal-radius)] bg-[var(--portal-surface-muted)] px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap'>
                {createdKey}
              </pre>
              <CopyButton
                value={createdKey}
                variant='outline'
                tooltip={t('Copy API key')}
                aria-label={t('Copy API key')}
              />
            </div>
            <DialogFooter>
              <Button type='button' onClick={() => handleOpenChange(false)}>
                {t('Done')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingKey ? t('Update API Key') : t('Create API Key')}
              </DialogTitle>
              <DialogDescription>
                {editingKey
                  ? t('Update API token “{{name}}”', { name: editingKey.name })
                  : t('Create a key for your app or service')}
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='portal-key-name'>{t('Name')}</Label>
                <Input
                  id='portal-key-name'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('Name')}
                  autoFocus={!editingKey}
                  disabled={editingKey != null}
                  readOnly={editingKey != null}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Group')}</Label>
                <ApiKeyGroupCombobox
                  options={groups}
                  value={group}
                  onValueChange={(nextGroup) => {
                    setGroup(nextGroup)
                    setCrossGroupRetry(nextGroup === 'auto')
                    if (nextGroup !== 'auto') {
                      setAutoGroupsMode('inherit')
                      setAutoGroups([])
                    }
                  }}
                  placeholder={t('Select a group')}
                  disabled={groupsQuery.isLoading}
                />
              </div>
              {group === 'auto' ? (
                <div className='space-y-2'>
                  <Label>{t('Auto group order')}</Label>
                  <p className='text-muted-foreground text-xs'>
                    {t('Choose and order the groups this API key will try.')}
                  </p>
                  <AutoGroupOrderEditor
                    value={autoGroups}
                    mode={autoGroupsMode}
                    options={groups}
                    globalOptions={globalAutoGroupOptions}
                    maxCount={maxAutoGroups}
                    onChange={(value) => {
                      setAutoGroupsMode(value.mode)
                      setAutoGroups(value.groups.slice(0, maxAutoGroups))
                    }}
                  />
                </div>
              ) : null}
              <div className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                  <Label htmlFor='portal-key-clear-encrypted'>
                    {t('Drop unverified encrypted reasoning')}
                  </Label>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {t(
                      'When encrypted reasoning cannot be verified, or the session is blocked by a cyber-security policy, remove it and retry the request once.'
                    )}
                  </p>
                </div>
                <Switch
                  id='portal-key-clear-encrypted'
                  checked={clearEncryptedContent}
                  onCheckedChange={(checked) =>
                    setClearEncryptedContent(checked === true)
                  }
                />
              </div>
              {group === 'auto' ? (
                <div className='flex items-center justify-between gap-3'>
                  <div className='min-w-0'>
                    <Label htmlFor='portal-key-cross-group'>
                      {t('Cross-group retry')}
                    </Label>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t(
                        'When enabled, if channels in the current group fail, it will try channels in the next group in order.'
                      )}
                    </p>
                  </div>
                  <Switch
                    id='portal-key-cross-group'
                    checked={crossGroupRetry}
                    onCheckedChange={(checked) =>
                      setCrossGroupRetry(checked === true)
                    }
                  />
                </div>
              ) : null}
              <div className='flex items-center justify-between gap-3'>
                <Label htmlFor='portal-key-unlimited'>{t('Unlimited')}</Label>
                <Switch
                  id='portal-key-unlimited'
                  checked={unlimited}
                  onCheckedChange={(checked) => setUnlimited(checked === true)}
                />
              </div>
              {unlimited ? null : (
                <div className='space-y-2'>
                  <Label htmlFor='portal-key-quota'>{t('Quota')}</Label>
                  <Input
                    id='portal-key-quota'
                    type='number'
                    min={0}
                    step='0.01'
                    value={quotaDollars}
                    onChange={(event) => setQuotaDollars(event.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                disabled={submitting}
                onClick={() => handleOpenChange(false)}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                disabled={submitting}
                onClick={() => {
                  void handleSubmit()
                }}
              >
                {editingKey ? t('Save') : t('Create')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
