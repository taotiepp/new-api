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

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import type { EditorGroup } from '../lib/draft'

export function GroupList(props: {
  groups: EditorGroup[]
  loading: boolean
  onAdd: () => void
  onEdit: (localId: string) => void
  onRemove: (localId: string) => void
}) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div
        aria-busy='true'
        aria-label={t('Virtual groups')}
        className='overflow-hidden rounded-xl border'
      >
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className='flex items-center gap-3 border-b px-4 py-4 last:border-b-0'
          >
            <Skeleton className='h-4 w-40' />
            <Skeleton className='ml-auto h-7 w-16' />
          </div>
        ))}
      </div>
    )
  }

  if (props.groups.length === 0) {
    return (
      <EmptyState
        bordered
        title={t('No virtual groups yet')}
        action={
          <Button type='button' onClick={props.onAdd}>
            {t('Add group')}
          </Button>
        }
      />
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex justify-end'>
        <Button type='button' onClick={props.onAdd}>
          {t('Add group')}
        </Button>
      </div>
      <ul className='bg-card divide-y overflow-hidden rounded-xl border'>
        {props.groups.map((group) => {
          const names = group.models
            .map((model) => model.name)
            .filter((name) => name !== '')
          return (
            <li
              key={group.localId}
              className='flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center'
            >
              <div className='min-w-0 flex-1'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='truncate font-medium' title={group.name}>
                    {group.name}
                  </span>
                  <Badge variant='secondary' className='shrink-0'>
                    {t('{{count}} models', { count: group.models.length })}
                  </Badge>
                </div>
                <p
                  className='text-muted-foreground mt-1 truncate text-sm'
                  title={names.join(', ')}
                >
                  {names.length === 0
                    ? t('No models in this virtual group')
                    : names.join(', ')}
                </p>
              </div>
              <div className='flex shrink-0 gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  aria-label={t('Edit {{name}}', { name: group.name })}
                  onClick={() => props.onEdit(group.localId)}
                >
                  {t('Edit')}
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  aria-label={t('Remove {{name}}', { name: group.name })}
                  onClick={() => props.onRemove(group.localId)}
                >
                  {t('Remove')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
