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
import { useMemo } from 'react'

import { usePricingCurrency } from '@/lib/currency'

import {
  getDynamicPricingSummary,
  formatTaskUsageUnitPrice,
  type DynamicPriceOptions,
} from '../lib/dynamic-price'
import { createPriceFormatters } from '../lib/price'
import type { PricingModel } from '../types'

/** Bind shared pricing calculations to the current display currency. */
export function usePricingFormatters() {
  const pricing = usePricingCurrency()
  return useMemo(
    () => ({
      ...pricing,
      ...createPriceFormatters(pricing.formatCurrency),
      getDynamicPricingSummary: (
        model: PricingModel,
        options: DynamicPriceOptions
      ) =>
        getDynamicPricingSummary(model, {
          ...options,
          formatCurrency: pricing.formatCurrency,
        }),
      formatTaskUsageUnitPrice: (value: number, options: DynamicPriceOptions) =>
        formatTaskUsageUnitPrice(value, {
          ...options,
          formatCurrency: pricing.formatCurrency,
        }),
    }),
    [pricing]
  )
}
