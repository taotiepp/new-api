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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getUserGroups,
  getUserModels,
  getVirtualGroups,
  updateVirtualGroups,
  type VirtualGroup,
  type VirtualGroupModel,
} from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

type EditorModel = VirtualGroupModel & { localId: string }
type EditorGroup = Omit<VirtualGroup, 'models'> & { models: EditorModel[] }

function withLocalIds(groups: VirtualGroup[]): EditorGroup[] {
  return groups.map((group) => ({
    ...group,
    models: (group.models ?? []).map((model) => ({
      ...model,
      localId: crypto.randomUUID(),
    })),
  }))
}

function toVirtualGroups(groups: EditorGroup[]): VirtualGroup[] {
  return groups.map((group) => ({
    name: group.name,
    models: group.models.map((model) => ({
      name: model.name,
      source_group: model.source_group,
      source_model: model.source_model,
      redirect: model.redirect ?? '',
    })),
  }))
}

export function VirtualGroupsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [groups, setGroups] = useState<EditorGroup[]>([])
  const [groupName, setGroupName] = useState('')
  const [loaded, setLoaded] = useState(false)

  const catalogQuery = useQuery({
    queryKey: ['virtual-groups'],
    queryFn: async () => requireServerSuccess(await getVirtualGroups()),
  })
  const groupsQuery = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
  })

  useEffect(() => {
    if (!catalogQuery.data || loaded) return
    setGroups(withLocalIds(catalogQuery.data.data ?? []))
    setLoaded(true)
  }, [catalogQuery.data, loaded])

  const sourceGroups = useMemo(
    () =>
      Object.entries(groupsQuery.data?.data ?? {})
        .filter(([name, info]) => name !== 'auto' && !info.virtual)
        .map(([name, info]) => ({
          value: name,
          label: info.desc ? `${name} · ${info.desc}` : name,
        })),
    [groupsQuery.data]
  )

  const saveMutation = useMutation({
    mutationFn: async () =>
      requireServerSuccess(await updateVirtualGroups(toVirtualGroups(groups))),
    onSuccess: async () => {
      toast.success(t('Virtual groups saved'))
      await queryClient.invalidateQueries({ queryKey: ['virtual-groups'] })
      await queryClient.invalidateQueries({ queryKey: ['user-groups'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const addGroup = () => {
    const name = groupName.trim()
    if (!name) {
      toast.error(t('Group name is required'))
      return
    }
    if (groups.some((group) => group.name === name)) {
      toast.error(t('Virtual group name is duplicated'))
      return
    }
    setGroups((current) => [...current, { name, models: [] }])
    setGroupName('')
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Virtual groups')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || catalogQuery.isLoading}
        >
          {t('Save')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex max-w-5xl flex-col gap-4'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Add models from groups you can already use. Requests are billed with the source group and source model.'
            )}
          </p>
          <div className='flex flex-wrap items-end gap-2'>
            <div className='flex min-w-56 flex-col gap-1.5'>
              <Label htmlFor='virtual-group-name'>{t('Group name')}</Label>
              <Input
                id='virtual-group-name'
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addGroup()
                }}
                placeholder={t('Group name')}
              />
            </div>
            <Button type='button' variant='outline' onClick={addGroup}>
              {t('Add group')}
            </Button>
          </div>
          {groups.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              {t('No virtual groups yet')}
            </p>
          ) : (
            groups.map((group) => (
              <VirtualGroupCard
                key={group.name}
                group={group}
                sourceGroups={sourceGroups}
                onChange={(next) =>
                  setGroups((current) =>
                    current.map((item) =>
                      item.name === group.name ? next : item
                    )
                  )
                }
                onRemove={() =>
                  setGroups((current) =>
                    current.filter((item) => item.name !== group.name)
                  )
                }
              />
            ))
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

type SourceGroupOption = {
  value: string
  label: string
}

function VirtualGroupCard(props: {
  group: EditorGroup
  sourceGroups: SourceGroupOption[]
  onChange: (group: EditorGroup) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [sourceGroup, setSourceGroup] = useState(
    props.sourceGroups[0]?.value ?? ''
  )
  const [sourceModel, setSourceModel] = useState('')
  const modelsQuery = useQuery({
    queryKey: ['user-models', sourceGroup],
    queryFn: async () => requireServerSuccess(await getUserModels(sourceGroup)),
    enabled: sourceGroup !== '',
  })
  const modelOptions = (modelsQuery.data?.data ?? []).map((model) => ({
    value: model,
    label: model,
  }))

  const addModel = () => {
    if (!sourceGroup || !sourceModel) {
      toast.error(t('Select a group and a model'))
      return
    }
    if (props.group.models.some((model) => model.name === sourceModel)) {
      toast.error(t('This model is already in the virtual group'))
      return
    }
    const next: EditorModel = {
      name: sourceModel,
      source_group: sourceGroup,
      source_model: sourceModel,
      redirect: '',
      localId: crypto.randomUUID(),
    }
    props.onChange({
      ...props.group,
      models: [...props.group.models, next],
    })
    setSourceModel('')
  }

  const updateModel = (localId: string, patch: Partial<VirtualGroupModel>) => {
    props.onChange({
      ...props.group,
      models: props.group.models.map((model) =>
        model.localId === localId ? { ...model, ...patch } : model
      ),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.group.name}</CardTitle>
        <CardAction>
          <Button type='button' variant='outline' onClick={props.onRemove}>
            {t('Remove')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end'>
          <div className='flex flex-col gap-1.5'>
            <Label>{t('Source group')}</Label>
            <Combobox
              options={props.sourceGroups}
              value={sourceGroup}
              onValueChange={(value) => {
                setSourceGroup(value ?? '')
                setSourceModel('')
              }}
              placeholder={t('Select a group')}
              aria-label={t('Source group')}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label>{t('Source model')}</Label>
            <Combobox
              options={modelOptions}
              value={sourceModel}
              onValueChange={(value) => setSourceModel(value ?? '')}
              placeholder={t('Select a model')}
              disabled={!sourceGroup}
              aria-label={t('Source model')}
            />
          </div>
          <Button type='button' variant='outline' onClick={addModel}>
            {t('Add model')}
          </Button>
        </div>
        {props.group.models.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No models in this virtual group')}
          </p>
        ) : (
          <div className='flex flex-col gap-3'>
            {props.group.models.map((model) => (
              <div
                key={model.localId}
                className='grid gap-3 border-t pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end'
              >
                <div className='flex flex-col gap-1.5'>
                  <Label>{t('Source')}</Label>
                  <p className='text-sm'>
                    {model.source_group}/{model.source_model}
                  </p>
                </div>
                <div className='flex flex-col gap-1.5'>
                  <Label htmlFor={`public-name-${model.localId}`}>
                    {t('Public name')}
                  </Label>
                  <Input
                    id={`public-name-${model.localId}`}
                    value={model.name}
                    onChange={(event) =>
                      updateModel(model.localId, { name: event.target.value })
                    }
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
                  <Label htmlFor={`redirect-${model.localId}`}>
                    {t('Redirect')}
                  </Label>
                  <Input
                    id={`redirect-${model.localId}`}
                    value={model.redirect ?? ''}
                    onChange={(event) =>
                      updateModel(model.localId, {
                        redirect: event.target.value,
                      })
                    }
                    placeholder={t('Optional upstream model')}
                  />
                </div>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() =>
                    props.onChange({
                      ...props.group,
                      models: props.group.models.filter(
                        (item) => item.localId !== model.localId
                      ),
                    })
                  }
                >
                  {t('Remove')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
