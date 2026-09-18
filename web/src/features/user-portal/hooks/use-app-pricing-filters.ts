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
import { useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'

import { useDebounce } from '@/hooks/use-debounce'
import { SORT_OPTIONS } from '@/features/pricing/constants'
import type { PricingModel } from '@/features/pricing/types'

import {
  filterPortalCatalogBySearch,
  filterPortalCatalogByVendor,
  listPortalCatalogVendors,
  PORTAL_VENDOR_ALL,
  sortPortalCatalogModels,
} from '../lib/catalog-filters'

type PortalCatalogSearch = {
  search?: string
  sort?: string
  vendor?: string
}

export function useAppPricingFilters(models: PricingModel[]) {
  const search = useSearch({ strict: false }) as PortalCatalogSearch
  const [filterState, setFilterState] = useState<PortalCatalogSearch>(() => ({
    search: search.search,
    sort: search.sort,
    vendor: search.vendor,
  }))

  const searchInput = filterState.search || ''
  const debouncedSearchInput = useDebounce(searchInput, 200)
  const sortBy = filterState.sort || SORT_OPTIONS.NAME
  const vendorFilter = filterState.vendor || PORTAL_VENDOR_ALL

  const updateFilters = useCallback((updates: Record<string, unknown>) => {
    setFilterState((prev) => {
      const next: Record<string, unknown> = { ...prev, ...updates }
      for (const key of Object.keys(next)) {
        if (next[key] === undefined || next[key] === null) {
          delete next[key]
        }
      }
      return next as PortalCatalogSearch
    })
  }, [])

  const setSearchInput = useCallback(
    (value: string) => updateFilters({ search: value || undefined }),
    [updateFilters],
  )

  const setSortBy = useCallback(
    (value: string) =>
      updateFilters({ sort: value === SORT_OPTIONS.NAME ? undefined : value }),
    [updateFilters],
  )

  const setVendorFilter = useCallback(
    (value: string) =>
      updateFilters({
        vendor: value === PORTAL_VENDOR_ALL ? undefined : value,
      }),
    [updateFilters],
  )

  const vendors = useMemo(() => listPortalCatalogVendors(models), [models])

  const filteredModels = useMemo(() => {
    if (models.length === 0) return []
    const searched = filterPortalCatalogBySearch(models, debouncedSearchInput)
    const byVendor = filterPortalCatalogByVendor(searched, vendorFilter)
    return sortPortalCatalogModels(byVendor, sortBy)
  }, [models, debouncedSearchInput, vendorFilter, sortBy])

  const clearSearch = useCallback(() => {
    updateFilters({ search: undefined })
  }, [updateFilters])

  const clearFilters = useCallback(() => {
    updateFilters({ search: undefined, vendor: undefined })
  }, [updateFilters])

  return {
    searchInput,
    sortBy,
    vendorFilter,
    vendors,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    filteredModels,
    clearSearch,
    clearFilters,
  }
}
