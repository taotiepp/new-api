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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatGroupRate } from '@/features/virtual-groups/lib/group-rate'
import { handleServerError } from '@/lib/handle-server-error'

import { getAccountOperations, updateAccountOperations } from '../api'
import type { AccountMonthCost } from '../types'

type AccountOperationsDialogProps = {
  account: AccountMonthCost
  onClose: () => void
}

export function AccountOperationsDialog(props: AccountOperationsDialogProps) {
  const { t } = useTranslation()
  const userId = props.account.user_id
  const loadedFor = useRef<number | null>(null)
  const [custom, setCustom] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const settings = useQuery({
    queryKey: ['account-operations', userId],
    queryFn: () => getAccountOperations(userId),
  })

  useEffect(() => {
    if (!settings.data || loadedFor.current === userId) return
    loadedFor.current = userId
    const allowed = settings.data.groups
      .filter((group) => group.allowed)
      .map((group) => group.name)
    const nextDrafts: Record<string, string> = {}
    for (const group of settings.data.groups) {
      nextDrafts[group.name] =
        group.discount == null ? '' : String(group.discount)
    }
    setCustom(settings.data.custom)
    setSelected(new Set(allowed))
    setDrafts(nextDrafts)
  }, [settings.data, userId])

  const groups = settings.data?.groups ?? []
  const discountGroups = groups.filter((group) => {
    if (group.assigned) return true
    if (custom) return selected.has(group.name)
    return group.inherited
  })

  const save = async () => {
    const discounts: Record<string, number | null> = {}
    for (const group of discountGroups) {
      const raw = (drafts[group.name] ?? '').trim()
      if (raw === '') {
        discounts[group.name] = null
        continue
      }
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0) {
        toast.error(t('Enter a group discount of 0 or greater.'))
        return
      }
      discounts[group.name] = value
    }
    setSaving(true)
    try {
      await updateAccountOperations(userId, {
        custom,
        groups: custom ? [...selected] : [],
        discounts,
      })
      toast.success(t('Operations settings saved'))
      props.onClose()
    } catch (error) {
      handleServerError(error, t('Could not save operations settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title={t('Operations settings')}
      description={props.account.username}
      contentClassName='sm:max-w-3xl'
      bodyClassName='space-y-6'
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      footer={
        <>
          <Button type='button' variant='outline' onClick={props.onClose}>
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={saving || !settings.isSuccess}
            onClick={() => void save()}
          >
            {t('Save')}
          </Button>
        </>
      }
    >
      {settings.isLoading ? <LoadingState /> : null}
      {settings.isError ? (
        <ErrorState
          description={settings.error.message}
          title={t('Could not load operations settings')}
          onRetry={() => void settings.refetch()}
        />
      ) : null}
      {settings.isSuccess ? (
        <>
          <section className='space-y-3'>
            <h3 className='text-sm font-medium'>{t('Group permissions')}</h3>
            <div className='flex items-start justify-between gap-4'>
              <div className='space-y-1'>
                <Label htmlFor='custom-usable-groups'>
                  {t('Custom usable resource groups')}
                </Label>
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'When enabled, this user can only use the checked resource groups. The assigned group is always allowed.'
                  )}
                </p>
              </div>
              <Switch
                id='custom-usable-groups'
                checked={custom}
                onCheckedChange={(checked) => setCustom(checked)}
              />
            </div>
            {custom ? (
              <div className='space-y-2 rounded-md border p-3'>
                {groups.length === 0 ? (
                  <p className='text-muted-foreground text-xs'>
                    {t('No resource groups available.')}
                  </p>
                ) : null}
                {groups.map((group) => (
                  <label key={group.name} className='flex items-start gap-3'>
                    <Checkbox
                      checked={group.assigned || selected.has(group.name)}
                      disabled={group.assigned}
                      onCheckedChange={(checked) => {
                        if (group.assigned) return
                        setSelected((current) => {
                          const next = new Set(current)
                          if (checked === true) next.add(group.name)
                          else next.delete(group.name)
                          return next
                        })
                      }}
                    />
                    <span className='flex flex-col gap-1'>
                      <span className='text-sm font-medium'>{group.name}</span>
                      {group.description !== group.name ? (
                        <span className='text-muted-foreground text-xs'>
                          {group.description}
                        </span>
                      ) : null}
                      {group.assigned ? (
                        <span className='text-muted-foreground text-xs'>
                          {t(
                            "This is the user's assigned group and cannot be removed."
                          )}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </section>
          <section className='space-y-3'>
            <div className='space-y-1'>
              <h3 className='text-sm font-medium'>
                {t('Resource group discounts')}
              </h3>
              <p className='text-muted-foreground text-xs'>
                {t('Leave empty to use the resource group default.')}
              </p>
            </div>
            {discountGroups.length === 0 ? (
              <p className='text-muted-foreground text-xs'>
                {t('No resource groups available.')}
              </p>
            ) : (
              <div className='overflow-x-auto rounded-md border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/40 text-left'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>{t('Group')}</th>
                      <th className='px-3 py-2 font-medium'>
                        {t('Default group discount')}
                      </th>
                      <th className='px-3 py-2 font-medium'>
                        {t('Custom group discount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountGroups.map((group) => (
                      <tr key={group.name} className='border-t'>
                        <td className='px-3 py-2'>
                          <div className='font-medium'>{group.name}</div>
                          {group.description !== group.name ? (
                            <div className='text-muted-foreground text-xs'>
                              {group.description}
                            </div>
                          ) : null}
                        </td>
                        <td className='px-3 py-2 tabular-nums'>
                          {formatGroupRate(group.default_ratio)}
                        </td>
                        <td className='px-3 py-2'>
                          <Input
                            aria-label={t(
                              'Custom group discount for {{group}}',
                              { group: group.name }
                            )}
                            inputMode='decimal'
                            value={drafts[group.name] ?? ''}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [group.name]: event.target.value,
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </Dialog>
  )
}
