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

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  PORTAL_GROUP_ALL,
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
  groupFilter: string
  groups: string[]
  onGroupChange: (value: string) => void
  trailing?: ReactNode
}

export function PortalCatalogToolbar(props: PortalCatalogToolbarProps) {
  const { t } = useTranslation()
  const groupItems = [
    { value: PORTAL_GROUP_ALL, label: t('All') },
    ...props.groups.map((group) => ({ value: group, label: group })),
  ]
  const vendorItems: Array<{
    value: string
    label: string
    icon?: string
    count?: number
  }> = [
    { value: PORTAL_VENDOR_ALL, label: t('All') },
    ...props.vendors.map((vendor) => ({
      value: vendor.value,
      label:
        vendor.value === PORTAL_VENDOR_OTHER
          ? t('Other')
          : vendor.name || t('Other'),
      icon: vendor.icon,
      count: vendor.count,
    })),
  ]

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
        <div className='min-w-0 flex-1'>{props.trailing}</div>
        {props.groups.length > 0 ? (
          <Select
            items={groupItems}
            value={props.groupFilter}
            onValueChange={(value) => {
              if (value) props.onGroupChange(value)
            }}
          >
            <SelectTrigger
              size='sm'
              className='w-full lg:w-44'
              aria-label={t('Group')}
            >
              <SelectValue>
                <span className='truncate'>
                  {t('Group')}{' '}
                  {groupItems.find((item) => item.value === props.groupFilter)
                    ?.label ?? t('All')}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {groupItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        {props.vendors.length > 0 ? (
          <Select
            items={vendorItems.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            value={props.vendorFilter}
            onValueChange={(value) => {
              if (value) props.onVendorChange(value)
            }}
          >
            <SelectTrigger
              size='sm'
              className='w-full lg:w-52'
              aria-label={t('Vendors')}
            >
              <SelectValue>
                <span className='truncate'>
                  {t('Vendor')}{' '}
                  {vendorItems.find((item) => item.value === props.vendorFilter)
                    ?.label ?? t('All')}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {vendorItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <span className='flex min-w-0 items-center gap-2'>
                      {item.icon ? (
                        <span className='size-3.5 shrink-0'>
                          {getLobeIcon(item.icon, 14)}
                        </span>
                      ) : null}
                      <span className='truncate'>{item.label}</span>
                      {item.count != null ? (
                        <span className='text-muted-foreground tabular-nums'>
                          {item.count}
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        <p className='text-sm text-[var(--portal-ink-muted)] tabular-nums lg:shrink-0'>
          {t('{{count}} models', { count: props.filteredCount })}
        </p>
      </div>
      {props.filteredCount !== props.totalCount ? (
        <p className='text-muted-foreground text-sm'>
          {t('This site currently has {{count}} models enabled', {
            count: props.totalCount,
          })}
        </p>
      ) : null}
    </div>
  )
}
