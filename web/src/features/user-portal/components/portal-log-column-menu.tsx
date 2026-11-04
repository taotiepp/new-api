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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PORTAL_LOG_COLUMNS } from '../lib/portal-log-columns'

type PortalLogColumnMenuProps = {
  hiddenColumnIds: ReadonlySet<string>
  onColumnVisibleChange: (id: string, visible: boolean) => void
}

export function PortalLogColumnMenu(props: PortalLogColumnMenuProps) {
  const { t } = useTranslation()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='sm'
            aria-label={t('View')}
          />
        }
      >
        {t('View')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('Toggle columns')}</DropdownMenuLabel>
          {PORTAL_LOG_COLUMNS.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={!props.hiddenColumnIds.has(column.id)}
              closeOnClick={false}
              onCheckedChange={(checked) =>
                props.onColumnVisibleChange(column.id, checked === true)
              }
            >
              {t(column.label)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
