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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import {
  GroupLimitDialog,
  type GroupLimitEntryData,
} from './group-limit-dialog'
import {
  ModelLimitDialog,
  type ModelLimitEntryData,
} from './model-limit-dialog'
import { ModelLimitFields } from './model-limit-fields'
import {
  parseUserModelRateLimitConfig,
  serializeUserModelRateLimitConfig,
  type ModelRateLimitValue,
  type UserModelRateLimitConfigValue,
} from './user-model-rate-limit-config'
import {
  formatLimitCell,
  formatTokenMode,
} from './user-model-rate-limit-format'

type UserModelRateLimitEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function UserModelRateLimitEditor(props: UserModelRateLimitEditorProps) {
  const { t } = useTranslation()
  const config = useMemo(
    () => parseUserModelRateLimitConfig(props.value),
    [props.value]
  )

  const [modelDialogOpen, setModelDialogOpen] = useState(false)
  const [modelEdit, setModelEdit] = useState<ModelLimitEntryData | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupEdit, setGroupEdit] = useState<GroupLimitEntryData | null>(null)

  const commit = (next: UserModelRateLimitConfigValue) => {
    props.onChange(serializeUserModelRateLimitConfig(next))
  }

  const modelRows = Object.entries(config.models).map(([name, limits]) => ({
    name,
    limits,
  }))
  const groupRows = Object.entries(config.groups).map(([name, group]) => ({
    name,
    group,
  }))

  const handleSaveModel = (data: ModelLimitEntryData) => {
    const models = { ...config.models }
    if (modelEdit && modelEdit.name !== data.name) {
      delete models[modelEdit.name]
    }
    models[data.name] = data.limits
    commit({ ...config, models })
    setModelEdit(null)
  }

  const handleDeleteModel = (name: string) => {
    const models = { ...config.models }
    delete models[name]
    commit({ ...config, models })
  }

  const handleSaveGroup = (data: GroupLimitEntryData) => {
    const groups = { ...config.groups }
    if (groupEdit && groupEdit.name !== data.name) {
      delete groups[groupEdit.name]
    }
    groups[data.name] = data.group
    commit({ ...config, groups })
    setGroupEdit(null)
  }

  const handleDeleteGroup = (name: string) => {
    const groups = { ...config.groups }
    delete groups[name]
    commit({ ...config, groups })
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <Label className='text-sm font-medium'>
            {t('Enable per-user model limits')}
          </Label>
          <p className='text-muted-foreground text-xs'>
            {t('Apply RPM and TPM limits per user, group and model.')}
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => commit({ ...config, enabled: checked })}
        />
      </div>

      <div className='grid gap-1.5 sm:max-w-[240px]'>
        <Label className='text-xs'>{t('Limit period')}</Label>
        <div className='flex items-center gap-2'>
          <Input
            type='number'
            min={1}
            step={1}
            value={config.duration_minutes}
            onChange={(e) => {
              const minutes = Number.parseInt(e.target.value, 10)
              commit({
                ...config,
                duration_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 1,
              })
            }}
          />
          <span className='text-muted-foreground text-sm'>{t('minutes')}</span>
        </div>
      </div>

      <div className='space-y-2'>
        <Label className='text-sm font-medium'>{t('Global default limits')}</Label>
        <ModelLimitFields
          value={config.default}
          onChange={(next: ModelRateLimitValue) =>
            commit({ ...config, default: next })
          }
        />
      </div>

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label className='text-sm font-medium'>{t('Global model limits')}</Label>
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
          getRowKey={(row) => row.name}
          emptyContent={t('No global model limits configured.')}
          columns={[
            {
              id: 'model',
              header: t('Model Name'),
              cellClassName: 'font-medium',
              cell: (row) => row.name,
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
                    setModelEdit({ name: row.name, limits: row.limits })
                    setModelDialogOpen(true)
                  }}
                  onDelete={() => handleDeleteModel(row.name)}
                />
              ),
            },
          ]}
        />
      </div>

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label className='text-sm font-medium'>{t('Group limits')}</Label>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => {
              setGroupEdit(null)
              setGroupDialogOpen(true)
            }}
          >
            <Plus className='mr-2 h-4 w-4' />
            {t('Add group')}
          </Button>
        </div>
        <StaticDataTable
          data={groupRows}
          getRowKey={(row) => row.name}
          emptyContent={t('No group limits configured.')}
          columns={[
            {
              id: 'group',
              header: t('Group Name'),
              cellClassName: 'font-medium',
              cell: (row) => row.name,
            },
            {
              id: 'rpm',
              header: t('Default RPM'),
              className: 'text-right',
              cellClassName: 'text-right',
              cell: (row) => formatLimitCell(row.group.default.rpm, t),
            },
            {
              id: 'tpm',
              header: t('Default TPM'),
              className: 'text-right',
              cellClassName: 'text-right',
              cell: (row) => formatLimitCell(row.group.default.tpm, t),
            },
            {
              id: 'models',
              header: t('Models'),
              className: 'text-right',
              cellClassName: 'text-right',
              cell: (row) => Object.keys(row.group.models).length,
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
                    setGroupEdit({ name: row.name, group: row.group })
                    setGroupDialogOpen(true)
                  }}
                  onDelete={() => handleDeleteGroup(row.name)}
                />
              ),
            },
          ]}
        />
      </div>

      <ModelLimitDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        onSave={handleSaveModel}
        editData={modelEdit}
      />
      <GroupLimitDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onSave={handleSaveGroup}
        editData={groupEdit}
      />
    </div>
  )
}
