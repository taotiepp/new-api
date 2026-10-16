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
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PortalSearchProps = {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
  className?: string
  variant?: 'inline' | 'composer'
}

export function PortalSearch(props: PortalSearchProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const variant = props.variant ?? 'inline'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (variant === 'composer') {
    return (
      <div className={cn('portal-search-composer', props.className)}>
        <input
          ref={inputRef}
          type='search'
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={
            props.placeholder ?? t('Search models by name or description...')
          }
          aria-label={t('Search models')}
          className='border-b border-[var(--portal-hairline)]'
        />
        <div className='mt-3 flex items-center justify-end'>
          {props.value ? (
            <Button
              variant='ghost'
              size='sm'
              onClick={props.onClear}
              className='h-8 px-0 text-xs hover:bg-transparent'
            >
              {t('Clear search')}
            </Button>
          ) : (
            <kbd className='text-muted-foreground hidden text-xs sm:inline'>
              ⌘K
            </kbd>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-[var(--portal-hairline)]',
        props.className
      )}
    >
      <input
        ref={inputRef}
        type='search'
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={
          props.placeholder ?? t('Search models by name or description...')
        }
        className='h-9 min-w-0 flex-1 bg-transparent text-sm outline-none'
        aria-label={t('Search models')}
      />
      {props.value ? (
        <Button
          variant='ghost'
          size='sm'
          onClick={props.onClear}
          className='h-8 px-0 hover:bg-transparent'
        >
          {t('Clear search')}
        </Button>
      ) : null}
    </div>
  )
}
