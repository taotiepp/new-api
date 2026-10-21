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

import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'

export function GroupModelEntry(props: {
  sourceGroup: string
  sourceModel: string
  aliases: string[]
  onAliasesChange: (aliases: string[]) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const aliasFieldId = `aliases-${props.sourceGroup}-${props.sourceModel}`

  return (
    <li className='rounded-lg border'>
      <div className='flex items-center justify-between gap-3 border-b px-3 py-2'>
        <p className='min-w-0 truncate text-xs'>
          <span className='font-medium'>{props.sourceGroup}</span>
          <span className='text-muted-foreground'>
            {' / '}
            {props.sourceModel}
          </span>
        </p>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-label={t('Remove {{name}}', { name: props.sourceModel })}
          onClick={props.onRemove}
        >
          {t('Remove')}
        </Button>
      </div>
      <Field className='p-3'>
        <FieldLabel htmlFor={aliasFieldId}>{t('Aliases')}</FieldLabel>
        <MultiSelect
          id={aliasFieldId}
          options={props.aliases.map((alias) => ({
            value: alias,
            label: alias,
          }))}
          selected={props.aliases}
          onChange={props.onAliasesChange}
          allowCreate
          placeholder={t('Add an alias')}
        />
        <FieldDescription>
          {t('Requests for these names are served as {{model}}', {
            model: props.sourceModel,
          })}
        </FieldDescription>
      </Field>
    </li>
  )
}
