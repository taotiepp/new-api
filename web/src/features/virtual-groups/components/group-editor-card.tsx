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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { MultiSelect } from '@/components/multi-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { getUserModels } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  appendSourceModels,
  insertModelAlias,
  modelsForSave,
  renameModelAlias,
  type EditorModel,
  type GroupDraft,
  type GroupSession,
} from '../lib/draft'
import { GroupModelTable } from './group-model-table'

type SourceGroupOption = {
  value: string
  label: string
  ratio: number | null
}

export function GroupEditorCard(props: {
  mode: GroupSession['mode']
  initialName: string
  initialModels: EditorModel[]
  initialSourceGroup: string
  sourceGroups: SourceGroupOption[]
  draftStore: { current: { draft: GroupDraft | null } }
  pending?: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(props.initialName)
  const [models, setModels] = useState<EditorModel[]>(() =>
    props.initialModels.map((model) => ({ ...model }))
  )
  const [sourceGroup, setSourceGroup] = useState(props.initialSourceGroup)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [aliasFocusId, setAliasFocusId] = useState<string | null>(null)

  const draftModels = useCallback(() => {
    if (sourceGroup === '' || selectedModels.length === 0) return models
    return appendSourceModels(models, sourceGroup, selectedModels, () =>
      crypto.randomUUID()
    ).models
  }, [models, selectedModels, sourceGroup])

  const publishDraft = () => {
    props.draftStore.current.draft = {
      name,
      models: modelsForSave(draftModels()),
    }
  }

  useEffect(() => {
    props.draftStore.current.draft = {
      name,
      models: modelsForSave(draftModels()),
    }
  }, [draftModels, name, props.draftStore])

  useEffect(() => {
    if (aliasFocusId === null) return
    const input = document.querySelector(
      `#virtual-group-alias-${CSS.escape(aliasFocusId)}`
    )
    if (input instanceof HTMLInputElement) input.focus()
    setAliasFocusId(null)
  }, [aliasFocusId])

  useEffect(() => {
    if (sourceGroup !== '') return
    const first = props.sourceGroups[0]?.value
    if (!first) return
    setSourceGroup(first)
  }, [props.sourceGroups, sourceGroup])

  const modelsQuery = useQuery({
    queryKey: ['user-models', sourceGroup],
    queryFn: async () => requireServerSuccess(await getUserModels(sourceGroup)),
    enabled: sourceGroup !== '',
  })

  const taken = new Set(
    models
      .filter((model) => model.source_group === sourceGroup)
      .map((model) => model.source_model)
  )
  const modelOptions = (modelsQuery.data?.data ?? [])
    .filter((model) => !taken.has(model))
    .map((model) => ({ value: model, label: model }))

  const addSelected = () => {
    if (sourceGroup === '' || selectedModels.length === 0) {
      toast.error(t('Select a group and a model'))
      return
    }
    const result = appendSourceModels(models, sourceGroup, selectedModels, () =>
      crypto.randomUUID()
    )
    if (result.added === 0) {
      toast.error(t('This model is already in the virtual group'))
      return
    }
    if (result.skipped > 0) {
      toast.error(t('Some selected models are already in the virtual group'))
    }
    setModels(result.models)
    setSelectedModels([])
  }

  const modelCount = new Set(
    models.map((model) => `${model.source_group}\0${model.source_model}`)
  ).size

  const changeAlias = (localId: string, alias: string) => {
    const result = renameModelAlias(models, localId, alias)
    if (result.rejected) {
      toast.error(t('This model is already in the virtual group'))
      return
    }
    setModels(result.models)
  }

  const addAlias = (localId: string) => {
    const result = insertModelAlias(models, localId, () => crypto.randomUUID())
    setModels(result.models)
    if (result.localId !== null) setAliasFocusId(result.localId)
  }

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='border-b py-4'>
        <CardTitle>
          {props.mode === 'edit' ? t('Edit group') : t('Add group')}
        </CardTitle>
        <CardDescription>
          {t(
            'Add models from groups you can already use. Requests are billed with the source group and source model.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='py-4'>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor='virtual-group-name'>
              {t('Group name')}
            </FieldLabel>
            <Input
              id='virtual-group-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                publishDraft()
                props.onSave()
              }}
              placeholder={t('Group name')}
            />
          </Field>
          <FieldSet className='bg-muted/30 rounded-xl border p-4'>
            <FieldLegend variant='label'>{t('Source models')}</FieldLegend>
            <FieldDescription>
              {t(
                'Pick a source group, then select every model you want to add.'
              )}
            </FieldDescription>
            <Field>
              <FieldLabel htmlFor='virtual-group-source'>
                {t('Source group')}
              </FieldLabel>
              <Combobox
                id='virtual-group-source'
                options={props.sourceGroups}
                value={sourceGroup}
                onValueChange={(value) => {
                  setSourceGroup(value ?? '')
                  setSelectedModels([])
                }}
                placeholder={t('Select a group')}
                aria-label={t('Source group')}
              />
            </Field>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
              <div className='min-w-0 flex-1'>
                <MultiSelect
                  id='virtual-group-source-models'
                  options={modelOptions}
                  selected={selectedModels}
                  onChange={setSelectedModels}
                  placeholder={t('Select models')}
                  disabled={sourceGroup === ''}
                />
              </div>
              <Button
                type='button'
                variant='outline'
                disabled={sourceGroup === '' || selectedModels.length === 0}
                onClick={addSelected}
              >
                {t('Add selected models')}
              </Button>
            </div>
          </FieldSet>
          <section
            aria-labelledby='virtual-group-models-heading'
            className='flex flex-col gap-3'
          >
            <div className='flex items-center justify-between gap-3'>
              <h3
                id='virtual-group-models-heading'
                className='text-sm font-medium'
              >
                {t('Models in this group')}
              </h3>
              <Badge variant='secondary'>
                {t('{{count}} models', { count: modelCount })}
              </Badge>
            </div>
            {models.length === 0 ? (
              <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm'>
                {t('No models in this virtual group')}
              </p>
            ) : (
              <GroupModelTable
                models={models}
                groupRatios={Object.fromEntries(
                  props.sourceGroups.flatMap((group) =>
                    group.ratio == null ? [] : [[group.value, group.ratio]]
                  )
                )}
                onAliasChange={changeAlias}
                onAddAlias={addAlias}
                onRemove={(localId) =>
                  setModels((current) =>
                    current.filter((item) => item.localId !== localId)
                  )
                }
              />
            )}
          </section>
        </FieldGroup>
      </CardContent>
      <CardFooter className='justify-between gap-2'>
        <Button type='button' variant='outline' onClick={props.onCancel}>
          {t('Cancel')}
        </Button>
        <Button
          type='button'
          disabled={props.pending}
          onClick={() => {
            publishDraft()
            props.onSave()
          }}
        >
          {t('Save')}
        </Button>
      </CardFooter>
    </Card>
  )
}
