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
import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { searchUsers } from '@/features/users/api'
import { useDebounce } from '@/hooks/use-debounce'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import type { PortalSubjectUser } from '../hooks/use-portal-subject-user'
import { isAdminRole } from '../lib/access'

export function PortalSubjectUserPicker(props: {
  value: PortalSubjectUser | null
  onValueChange: (user: PortalSubjectUser | null) => void
}) {
  const { t } = useTranslation()
  const role = useAuthStore((state) => state.auth.user?.role)
  const selfId = useAuthStore((state) => state.auth.user?.id)
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 300)
  const search = useQuery({
    queryKey: ['user-portal', 'subject-user', debouncedKeyword],
    enabled: isAdminRole(role) && open && debouncedKeyword.length > 0,
    queryFn: async () => {
      const result = requireServerSuccess(
        await searchUsers({ keyword: debouncedKeyword, page_size: 8 })
      )
      return result.data?.items ?? []
    },
  })

  if (!isAdminRole(role)) return null

  const users = debouncedKeyword.length > 0 ? (search.data ?? []) : []
  const close = () => {
    setOpen(false)
    setKeyword('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setKeyword('')
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='sm'
            role='combobox'
            aria-expanded={open}
            aria-label={t('User')}
            className='max-w-52 min-w-36 justify-between'
          />
        }
      >
        <span className='truncate'>
          {props.value?.username ?? t('My account')}
        </span>
        <ChevronsUpDown className='size-3.5 opacity-50' />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-72 overflow-hidden rounded-xl p-0'
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('Search by username or email...')}
            value={keyword}
            onValueChange={setKeyword}
          />
          <CommandList>
            {debouncedKeyword.length > 0 &&
            !search.isFetching &&
            users.length === 0 ? (
              <CommandEmpty>{t('No users found')}</CommandEmpty>
            ) : null}
            <CommandGroup>
              <CommandItem
                value='self'
                onSelect={() => {
                  props.onValueChange(null)
                  close()
                }}
              >
                {t('My account')}
              </CommandItem>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={String(user.id)}
                  onSelect={() => {
                    if (user.id === selfId) {
                      props.onValueChange(null)
                    } else {
                      props.onValueChange({
                        id: user.id,
                        username: user.username,
                      })
                    }
                    close()
                  }}
                >
                  <span className='truncate'>{user.username}</span>
                  <span className='text-muted-foreground ml-auto font-mono text-xs'>
                    #{user.id}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
