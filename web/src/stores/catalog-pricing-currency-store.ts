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
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { PricingDisplayType } from '@/stores/system-config-store'

type CatalogPricingCurrencyState = {
  /** Null follows the site default from admin settings. */
  currency: PricingDisplayType | null
  setCurrency: (currency: PricingDisplayType) => void
}

export const useCatalogPricingCurrencyStore =
  create<CatalogPricingCurrencyState>()(
    persist(
      (set) => ({
        currency: null,
        setCurrency: (currency) => set({ currency }),
      }),
      {
        name: 'catalog-pricing-currency',
        partialize: (state) => ({ currency: state.currency }),
        merge: (persisted, current) => {
          const stored = persisted as
            | Partial<Pick<CatalogPricingCurrencyState, 'currency'>>
            | undefined
          const currency =
            stored?.currency === 'USD' || stored?.currency === 'CNY'
              ? stored.currency
              : null
          return { ...current, currency }
        },
      }
    )
  )
