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

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

import type { EditorModel } from '../lib/draft'

export function GroupModelEntry(props: {
  model: EditorModel
  onChange: (patch: Partial<EditorModel>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()

  return (
    <li className='rounded-lg border'>
      <div className='flex items-center justify-between gap-3 border-b px-3 py-2'>
        <p className='min-w-0 truncate text-xs'>
          <span className='font-medium'>{props.model.source_group}</span>
          <span className='text-muted-foreground'>
            {' / '}
            {props.model.source_model}
          </span>
        </p>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-label={t('Remove {{name}}', { name: props.model.source_model })}
          onClick={props.onRemove}
        >
          {t('Remove')}
        </Button>
      </div>
      <div className='grid gap-3 p-3 sm:grid-cols-2'>
        <Field>
          <FieldLabel htmlFor={`public-name-${props.model.localId}`}>
            {t('Public name')}
          </FieldLabel>
          <Input
            id={`public-name-${props.model.localId}`}
            value={props.model.name}
            onChange={(event) => props.onChange({ name: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`redirect-${props.model.localId}`}>
            {t('Redirect')}
          </FieldLabel>
          <Input
            id={`redirect-${props.model.localId}`}
            value={props.model.redirect ?? ''}
            onChange={(event) =>
              props.onChange({ redirect: event.target.value })
            }
            placeholder={t('Optional upstream model')}
          />
        </Field>
      </div>
    </li>
  )
}
