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
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { EditorModel } from '../lib/draft'

function actualModelName(model: EditorModel) {
  return `${model.source_group} / ${model.source_model}`
}

export function GroupModelTable(props: {
  models: EditorModel[]
  onAliasChange: (localId: string, name: string) => void
  onAddAlias: (localId: string) => void
  onRemove: (localId: string) => void
}) {
  const { t } = useTranslation()
  const columns: StaticDataTableColumn<EditorModel>[] = [
    {
      id: 'alias',
      header: t('Alias'),
      className: 'w-[36%]',
      cellClassName: 'overflow-visible whitespace-normal',
      cell: (model) => (
        <Input
          id={`virtual-group-alias-${model.localId}`}
          value={model.name}
          aria-label={t('Alias for {{model}}', {
            model: actualModelName(model),
          })}
          placeholder={t('Alias')}
          onChange={(event) =>
            props.onAliasChange(model.localId, event.target.value)
          }
          onBlur={(event) => {
            const trimmed = event.currentTarget.value.trim()
            if (trimmed === model.name) return
            props.onAliasChange(model.localId, trimmed)
          }}
        />
      ),
    },
    {
      id: 'model',
      header: t('Actual model'),
      cell: (model) => actualModelName(model),
    },
    {
      id: 'actions',
      header: t('Actions'),
      className: staticDataTableClassNames.actionHeaderCell,
      cellClassName: `${staticDataTableClassNames.actionCell} overflow-visible`,
      cell: (model) => {
        const actual = actualModelName(model)
        const removeName = model.name.trim() === '' ? actual : model.name.trim()
        return (
          <div className='flex justify-end gap-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              aria-label={t('Add an alias for {{model}}', { model: actual })}
              onClick={() => props.onAddAlias(model.localId)}
            >
              {t('Add an alias')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              aria-label={t('Remove {{name}}', { name: removeName })}
              onClick={() => props.onRemove(model.localId)}
            >
              {t('Remove')}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <StaticDataTable
      data={props.models}
      columns={columns}
      getRowKey={(model) => model.localId}
      headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
      tableProps={{ 'aria-labelledby': 'virtual-group-models-heading' }}
    />
  )
}
