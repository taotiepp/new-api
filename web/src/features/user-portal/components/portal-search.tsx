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
import { ArrowUp, Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { PortalBezel } from '@/components/layout/portal/portal-bezel'

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
      <PortalBezel
        className={cn('portal-search-composer', props.className)}
        innerClassName='p-4 sm:p-5'
        as='section'
      >
        <input
          ref={inputRef}
          type='search'
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={
            props.placeholder ??
            t('Search models by name or description...')
          }
          aria-label={t('Search models')}
        />
        <div className='mt-5 flex items-center justify-end gap-1.5'>
          {props.value ? (
            <Button
              variant='ghost'
              size='sm'
              onClick={props.onClear}
              className='rounded-full text-xs transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]'
            >
              {t('Clear search')}
            </Button>
          ) : (
            <kbd className='text-muted-foreground/60 hidden rounded-full border border-[var(--portal-hairline)] bg-[var(--portal-surface-muted)] px-2 py-0.5 font-mono text-[10px] sm:inline'>
              ⌘K
            </kbd>
          )}
          <span
            aria-hidden
            className='flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--portal-accent)] text-white shadow-[var(--portal-shadow-soft)]'
          >
            <ArrowUp className='size-4' />
          </span>
        </div>
      </PortalBezel>
    )
  }

  return (
      <PortalBezel
        tone='card'
        className={props.className}
        innerClassName='flex items-center gap-2 px-3 py-1'
      >
      <Search aria-hidden className='text-muted-foreground/60 size-3.5 shrink-0' />
      <input
        ref={inputRef}
        type='search'
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={
          props.placeholder ?? t('Search models by name or description...')
        }
        className='h-8 min-w-0 flex-1 bg-transparent text-sm outline-none'
        aria-label={t('Search models')}
      />
      {props.value ? (
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={props.onClear}
          aria-label={t('Clear search')}
          className='rounded-full active:scale-[0.98]'
        >
          <X className='size-4' />
        </Button>
      ) : null}
    </PortalBezel>
  )
}
