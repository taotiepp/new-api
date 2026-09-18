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
import { FILTER_ALL, SORT_OPTIONS } from '@/features/pricing/constants'
import type { PricingModel } from '@/features/pricing/types'

export const PORTAL_VENDOR_ALL = FILTER_ALL
export const PORTAL_VENDOR_OTHER = '__other__'

export type PortalVendorOption = {
  value: string
  name: string
  icon?: string
  count: number
}

export function filterPortalCatalogBySearch(
  models: PricingModel[],
  query: string,
): PricingModel[] {
  const trimmed = query.trim()
  if (!trimmed) return models

  const lowerQuery = trimmed.toLowerCase()
  return models.filter(
    (model) =>
      model.model_name?.toLowerCase().includes(lowerQuery) ||
      model.description?.toLowerCase().includes(lowerQuery) ||
      model.vendor_name?.toLowerCase().includes(lowerQuery),
  )
}

export function filterPortalCatalogByVendor(
  models: PricingModel[],
  vendor: string,
): PricingModel[] {
  if (!vendor || vendor === PORTAL_VENDOR_ALL) return models
  if (vendor === PORTAL_VENDOR_OTHER) {
    return models.filter((model) => !model.vendor_name?.trim())
  }
  return models.filter((model) => model.vendor_name === vendor)
}

export function listPortalCatalogVendors(
  models: PricingModel[],
): PortalVendorOption[] {
  const counts = new Map<string, PortalVendorOption>()
  for (const model of models) {
    const name = model.vendor_name?.trim() ?? ''
    const value = name ? name : PORTAL_VENDOR_OTHER
    const current = counts.get(value)
    if (current) {
      current.count += 1
      if (!current.icon && model.vendor_icon) current.icon = model.vendor_icon
      continue
    }
    counts.set(value, {
      value,
      name,
      icon: model.vendor_icon,
      count: 1,
    })
  }

  return [...counts.values()].sort((a, b) => {
    if (a.value === PORTAL_VENDOR_OTHER) return 1
    if (b.value === PORTAL_VENDOR_OTHER) return -1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export function sortPortalCatalogModels(
  models: PricingModel[],
  sortBy: string,
): PricingModel[] {
  const sorted = [...models]
  if (sortBy === SORT_OPTIONS.NAME) {
    sorted.sort((a, b) => {
      const aVendor = a.vendor_name || ''
      const bVendor = b.vendor_name || ''
      if (!aVendor && bVendor) return 1
      if (aVendor && !bVendor) return -1
      const vendorCmp = aVendor.localeCompare(bVendor, undefined, {
        sensitivity: 'base',
      })
      if (vendorCmp !== 0) return vendorCmp
      return (a.model_name || '').localeCompare(b.model_name || '', undefined, {
        sensitivity: 'base',
      })
    })
    return sorted
  }
  return sorted
}

export function groupPortalCatalogModels(
  models: PricingModel[],
): { vendor: string; models: PricingModel[] }[] {
  const groups: { vendor: string; models: PricingModel[] }[] = []
  for (const model of models) {
    const vendor = model.vendor_name?.trim() ?? ''
    const last = groups.at(-1)
    if (last && last.vendor === vendor) {
      last.models.push(model)
      continue
    }
    groups.push({ vendor, models: [model] })
  }
  return groups
}
