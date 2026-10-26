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

import { StaticDataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'

import { SUPPLIER_PROFILE_FIELDS, type SupplierFieldKey } from '../lib/fields'
import type { Supplier, SupplierGroup } from '../types'

type SupplierTableProps = {
  suppliers: Supplier[]
  onEdit: (supplier: Supplier) => void
}

export function SupplierTable(props: SupplierTableProps) {
  const { t } = useTranslation()
  const unset = t('Unset')
  const extraKeys = extraProfileKeys(props.suppliers)

  return (
    <StaticDataTable
      columns={[
        {
          id: 'name',
          header: t('Channel name'),
          cell: (supplier) => supplier.name,
        },
        {
          id: 'group',
          header: t('Group name'),
          cell: (supplier) => groupNames(supplier.groups, unset),
        },
        {
          id: 'group-discount',
          header: t('Group discount'),
          cell: (supplier) => groupDiscounts(supplier.groups, unset),
        },
        {
          id: 'discount',
          header: t('Channel discount'),
          cell: (supplier) => displayValue(supplier.discount, unset),
        },
        ...SUPPLIER_PROFILE_FIELDS.map((field) => ({
          id: field.key,
          header: t(field.labelKey),
          cell: (supplier: Supplier) =>
            displayValue(supplier.profile[field.key], unset),
        })),
        ...extraKeys.map((key) => ({
          id: `extra-${key}`,
          header: key,
          cell: (supplier: Supplier) =>
            displayValue(supplier.profile.extra?.[key], unset),
        })),
        {
          id: 'edit',
          header: t('Edit'),
          cell: (supplier) => (
            <Button
              size='sm'
              type='button'
              variant='outline'
              onClick={() => props.onEdit(supplier)}
            >
              {t('Edit')}
            </Button>
          ),
        },
      ]}
      data={props.suppliers}
      getRowKey={(supplier) => supplier.id}
    />
  )
}

function groupNames(groups: SupplierGroup[], unset: string): string {
  if (groups.length === 0) return unset
  return groups.map((group) => group.name).join(', ')
}

function groupDiscounts(groups: SupplierGroup[], unset: string): string {
  if (groups.length === 0) return unset
  return groups
    .map((group) => `${group.name} ${displayValue(group.discount, unset)}`)
    .join(', ')
}

function displayValue(value: unknown, unset: string): string {
  if (value == null || value === '') return unset
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function extraProfileKeys(suppliers: Supplier[]): string[] {
  const known = new Set<SupplierFieldKey>(
    SUPPLIER_PROFILE_FIELDS.map((field) => field.key)
  )
  const keys: string[] = []
  for (const supplier of suppliers) {
    for (const key of Object.keys(supplier.profile.extra ?? {})) {
      if (known.has(key as SupplierFieldKey) || keys.includes(key)) continue
      keys.push(key)
    }
  }
  return keys
}
