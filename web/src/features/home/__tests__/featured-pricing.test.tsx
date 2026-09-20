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
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useCatalogPricingCurrencyStore } from '@/stores/catalog-pricing-currency-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { HomeLanding } from '../components/home-landing'

const catalog = vi.hoisted(() => ({
  models: [
    {
      id: 1,
      model_name: 'dynamic-model',
      quota_type: 0,
      model_ratio: 999,
      completion_ratio: 2,
      enable_groups: [],
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", p * 2.5 + c * 15)',
    },
  ],
  vendors: [],
  isLoading: false,
  priceRate: 1,
  usdExchangeRate: 1,
}))
vi.mock('@/features/pricing/hooks/use-pricing-data', () => ({
  usePricingData: () => catalog,
}))
vi.mock('@/features/user-portal/hooks/use-portal-catalog-data', () => ({
  usePortalCatalogData: () => catalog,
}))
vi.mock('@/features/user-portal/components/user-portal-header', () => ({
  UserPortalHeader: () => null,
}))
vi.mock('@/features/user-portal/components/portal-nav-links', () => ({
  PortalNavLinks: () => null,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode }) => <a>{props.children}</a>,
}))

const initialCurrency = useSystemConfigStore.getState().config.currency
const initialOverride = useCatalogPricingCurrencyStore.getState().currency
beforeEach(() => {
  catalog.models[0].billing_expr = 'tier("base", p * 2.5 + c * 15)'
  useCatalogPricingCurrencyStore.setState({ currency: null })
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})
afterEach(() => {
  cleanup()
  useCatalogPricingCurrencyStore.setState({ currency: initialOverride })
  useSystemConfigStore.getState().setConfig({ currency: initialCurrency })
  vi.restoreAllMocks()
})
it('places featured model tiles in gray cards inside a white module', () => {
  render(<HomeLanding />)
  const tile = document.querySelector('.portal-model-tile')
  expect(tile).not.toBeNull()
  expect(tile?.classList.contains('portal-bezel-card')).toBe(true)
  const stage = tile?.closest('.portal-marketing-stage')
  const module = stage?.querySelector(':scope > .portal-module')
  expect(module).not.toBeNull()
  expect(tile?.closest('.portal-module')).toBe(module)
})

it('shows expression prices on the homepage instead of stale legacy ratios', () => {
  useCatalogPricingCurrencyStore.setState({ currency: null })
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  render(<HomeLanding />)
  expect(screen.getByText('2.5')).toBeVisible()
  expect(screen.getByText('15')).toBeVisible()
  expect(screen.queryByText(/1998/)).not.toBeInTheDocument()
})

it('shows fixed expression prices with request units on the homepage', () => {
  catalog.models[0].billing_expr = 'tier("request", fixed(0.01))'
  render(<HomeLanding />)
  expect(screen.getByText('0.01/request')).toBeVisible()
  expect(screen.queryByText(/1998/)).not.toBeInTheDocument()
})
it('shows a special expression label when a price cannot be summarized', () => {
  catalog.models[0].billing_expr = 'p * c'
  render(<HomeLanding />)
  expect(screen.getByText('Special billing expression')).toBeVisible()
  expect(screen.queryByText(/1998/)).not.toBeInTheDocument()
})
