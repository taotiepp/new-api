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
import { useMemo } from 'react'

import { useStatus } from '@/hooks/use-status'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getUserPortalCatalogPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'

export function usePortalCatalogData(enabled = true) {
  const { status } = useStatus()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pricing', 'user-portal-catalog'],
    queryFn: async () => requireServerSuccess(await getUserPortalCatalogPricing()),
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  const priceRate = useMemo(
    () => Math.max((status?.price as number) ?? 1, 0.001),
    [status?.price],
  )
  const usdExchangeRate = useMemo(
    () => Math.max((status?.usd_exchange_rate as number) ?? priceRate, 0.001),
    [status?.usd_exchange_rate, priceRate],
  )

  const models = useMemo((): PricingModel[] => {
    if (!data?.data) return []
    const vendorMap = new Map((data.vendors ?? []).map((vendor) => [vendor.id, vendor]))
    return data.data.map((model) => {
      const vendor = model.vendor_id ? vendorMap.get(model.vendor_id) : undefined
      return {
        ...model,
        key: model.model_name,
        enable_groups: [],
        vendor_name: vendor?.name,
        vendor_icon: vendor?.icon,
        vendor_description: vendor?.description,
        group_ratio: {},
      }
    })
  }, [data])

  return {
    models,
    vendors: data?.vendors ?? [],
    endpointMap: data?.supported_endpoint ?? {},
    isLoading,
    error,
    refetch,
    priceRate,
    usdExchangeRate,
  }
}
