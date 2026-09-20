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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  PORTAL_VENDOR_ALL,
  PORTAL_VENDOR_OTHER,
  type PortalVendorOption,
} from '../lib/catalog-filters'

type PortalCatalogToolbarProps = {
  totalCount: number
  filteredCount: number
  vendorFilter: string
  vendors: PortalVendorOption[]
  onVendorChange: (value: string) => void
  trailing?: ReactNode
}

export function PortalCatalogToolbar(props: PortalCatalogToolbarProps) {
  const { t } = useTranslation()
  const showVendorChips = props.vendors.length > 0

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <h2 className='text-xl font-semibold tracking-tight text-[var(--portal-ink)]'>
          {t('Models')}
          <span className='text-muted-foreground ms-2 text-sm font-medium tabular-nums'>
            {props.filteredCount}
          </span>
        </h2>
        {props.trailing}
      </div>
      {props.filteredCount !== props.totalCount ? (
        <p className='text-muted-foreground text-sm'>
          {t('This site currently has {{count}} models enabled', {
            count: props.totalCount,
          })}
        </p>
      ) : null}

      {showVendorChips ? (
        <div
          role='group'
          aria-label={t('Vendors')}
          className='flex flex-wrap gap-2'
        >
          <VendorChip
            selected={props.vendorFilter === PORTAL_VENDOR_ALL}
            onSelect={() => props.onVendorChange(PORTAL_VENDOR_ALL)}
            label={t('All')}
            count={props.totalCount}
          />
          {props.vendors.map((vendor) => (
            <VendorChip
              key={vendor.value}
              selected={props.vendorFilter === vendor.value}
              onSelect={() => props.onVendorChange(vendor.value)}
              label={
                vendor.value === PORTAL_VENDOR_OTHER ? t('Other') : vendor.name
              }
              count={vendor.count}
              icon={vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function VendorChip(props: {
  selected: boolean
  onSelect: () => void
  label: string
  count: number
  icon?: ReturnType<typeof getLobeIcon>
}) {
  return (
    <Button
      type='button'
      aria-pressed={props.selected}
      variant={props.selected ? 'default' : 'outline'}
      size='sm'
      className={cn(
        'h-8 rounded-full px-3',
        !props.selected &&
          'border-0 bg-[var(--portal-card)] text-[var(--portal-ink)]',
      )}
      onClick={props.onSelect}
    >
      {props.icon ? <span className='size-3.5 shrink-0'>{props.icon}</span> : null}
      <span>{props.label}</span>
      <span className='tabular-nums opacity-70'>{props.count}</span>
    </Button>
  )
}
