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
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { ModelLimitDialog, type ModelLimitEntryData } from './model-limit-dialog'
import { ModelLimitFields } from './model-limit-fields'
import {
  formatLimitCell,
  formatTokenMode,
} from './user-model-rate-limit-format'
import {
  emptyModelRateLimit,
  type GroupModelRateLimitValue,
  type ModelRateLimitValue,
} from './user-model-rate-limit-config'

export type GroupLimitEntryData = {
  name: string
  group: GroupModelRateLimitValue
}

type GroupLimitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: GroupLimitEntryData) => void
  editData?: GroupLimitEntryData | null
}

const emptyGroup = (): GroupModelRateLimitValue => ({
  default: emptyModelRateLimit(),
  models: {},
})

export function GroupLimitDialog(props: GroupLimitDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!props.editData

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [group, setGroup] = useState<GroupModelRateLimitValue>(emptyGroup())
  const [modelDialogOpen, setModelDialogOpen] = useState(false)
  const [modelEdit, setModelEdit] = useState<ModelLimitEntryData | null>(null)

  useEffect(() => {
    if (!props.open) return
    if (props.editData) {
      setName(props.editData.name)
      setGroup(props.editData.group)
    } else {
      setName('')
      setGroup(emptyGroup())
    }
    setNameError('')
    setModelEdit(null)
    setModelDialogOpen(false)
  }, [props.editData, props.open])

  const modelRows = Object.entries(group.models).map(([modelName, limits]) => ({
    modelName,
    limits,
  }))

  const handleSaveModel = (data: ModelLimitEntryData) => {
    setGroup((prev) => {
      const models = { ...prev.models }
      if (modelEdit && modelEdit.name !== data.name) {
        delete models[modelEdit.name]
      }
      models[data.name] = data.limits
      return { ...prev, models }
    })
    setModelEdit(null)
  }

  const handleDeleteModel = (modelName: string) => {
    setGroup((prev) => {
      const models = { ...prev.models }
      delete models[modelName]
      return { ...prev, models }
    })
  }

  const handleSubmit = () => {
    if (name.trim() === '') {
      setNameError(t('Group name is required'))
      return
    }
    props.onSave({ name: name.trim(), group })
    props.onOpenChange(false)
  }

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={isEditMode ? t('Edit group limits') : t('Add group limits')}
        description={t(
          'Configure default and per-model limits for a user group.'
        )}
        contentClassName='sm:max-w-[640px]'
        contentHeight='auto'
        bodyClassName='space-y-5'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => props.onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='button' onClick={handleSubmit}>
              {isEditMode ? t('Update') : t('Add')}
            </Button>
          </>
        }
      >
        <div className='grid gap-1.5'>
          <Label className='text-xs'>{t('Group Name')}</Label>
          <Input
            placeholder={t('e.g., default, vip')}
            value={name}
            disabled={isEditMode}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError('')
            }}
            aria-invalid={Boolean(nameError)}
          />
          {nameError && (
            <p className='text-destructive text-xs'>{nameError}</p>
          )}
          {!isEditMode && (
            <p className='text-muted-foreground text-xs'>
              {t('Must match a configured user group.')}
            </p>
          )}
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>
            {t('Group default limits')}
          </Label>
          <ModelLimitFields
            value={group.default}
            onChange={(next: ModelRateLimitValue) =>
              setGroup((prev) => ({ ...prev, default: next }))
            }
          />
        </div>

        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label className='text-sm font-medium'>
              {t('Per-model overrides')}
            </Label>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                setModelEdit(null)
                setModelDialogOpen(true)
              }}
            >
              <Plus className='mr-2 h-4 w-4' />
              {t('Add model')}
            </Button>
          </div>
          <StaticDataTable
            data={modelRows}
            getRowKey={(row) => row.modelName}
            emptyContent={t('No per-model overrides for this group.')}
            columns={[
              {
                id: 'model',
                header: t('Model Name'),
                cellClassName: 'font-medium',
                cell: (row) => row.modelName,
              },
              {
                id: 'rpm',
                header: t('RPM'),
                className: 'text-right',
                cellClassName: 'text-right',
                cell: (row) => formatLimitCell(row.limits.rpm, t),
              },
              {
                id: 'tpm',
                header: t('TPM'),
                className: 'text-right',
                cellClassName: 'text-right',
                cell: (row) => formatLimitCell(row.limits.tpm, t),
              },
              {
                id: 'mode',
                header: t('Token Mode'),
                cell: (row) => formatTokenMode(row.limits.token_mode, t),
              },
              {
                id: 'actions',
                header: t('Actions'),
                className: 'text-right',
                cellClassName: 'text-right',
                cell: (row) => (
                  <StaticRowActions
                    editLabel={t('Edit')}
                    deleteLabel={t('Delete')}
                    menuLabel={t('Open menu')}
                    onEdit={() => {
                      setModelEdit({ name: row.modelName, limits: row.limits })
                      setModelDialogOpen(true)
                    }}
                    onDelete={() => handleDeleteModel(row.modelName)}
                  />
                ),
              },
            ]}
          />
        </div>
      </Dialog>

      <ModelLimitDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        onSave={handleSaveModel}
        editData={modelEdit}
      />
    </>
  )
}
