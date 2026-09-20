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
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePricingDisplayType, formatPricingCurrency } from '@/lib/currency'
import { formatPricingQuota } from '@/lib/format'
import { mapStatusDataToConfig } from '@/lib/status-query'
import { useCatalogPricingCurrencyStore } from '@/stores/catalog-pricing-currency-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { usePricingFormatters } from '../hooks/use-pricing-formatters'
import { formatPrice } from '../lib/price'
import type { PricingModel } from '../types'

const model: PricingModel = {
  id: 1,
  model_name: 'gpt-test',
  quota_type: 0,
  model_ratio: 0.5,
  completion_ratio: 1,
  enable_groups: ['default'],
  group_ratio: { default: 1 },
}

afterEach(() => {
  useCatalogPricingCurrencyStore.setState({ currency: null })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG },
  })
})

describe('catalog pricing currency switch', () => {
  it('follows CNY quota when the pricing switch is unset', () => {
    expect(parsePricingDisplayType('', 'CNY')).toBe('CNY')
    expect(parsePricingDisplayType(undefined, 'USD')).toBe('USD')
    expect(parsePricingDisplayType('CNY', 'USD')).toBe('CNY')
    expect(parsePricingDisplayType('USD', 'CNY')).toBe('USD')
  })

  it('maps the resolved pricing currency from status onto catalog formatting', () => {
    const config = mapStatusDataToConfig({
      quota_display_type: 'USD',
      pricing_display_type: 'CNY',
      usd_exchange_rate: 7,
    })
    expect(config.currency?.pricingDisplayType).toBe('CNY')
  })

  it('shows CNY catalog prices even when quota display stays in USD', () => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'USD',
        pricingDisplayType: 'CNY',
        usdExchangeRate: 7,
      },
    })
    const formatted = formatPrice(model, 'input', 'M')
    expect(formatted).toMatch(/7/)
    expect(formatted).not.toMatch(/\$/)
  })

  it('keeps USD catalog prices when quota display is CNY', () => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CNY',
        pricingDisplayType: 'USD',
        usdExchangeRate: 7,
      },
    })
    expect(formatPrice(model, 'input', 'M')).toMatch(/\$/)
  })

  it('lets the navbar preference override the site catalog currency', () => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'USD',
        pricingDisplayType: 'USD',
        usdExchangeRate: 7,
      },
    })
    expect(formatPrice(model, 'input', 'M')).toMatch(/\$/)
    useCatalogPricingCurrencyStore.getState().setCurrency('CNY')
    expect(formatPrice(model, 'input', 'M')).toMatch(/7/)
    expect(formatPrice(model, 'input', 'M')).not.toMatch(/\$/)
  })

  it('formats usage quota on the frontend with the navbar pricing currency', () => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'USD',
        pricingDisplayType: 'USD',
        usdExchangeRate: 7,
        quotaPerUnit: 500000,
      },
    })
    expect(formatPricingQuota(500000)).toMatch(/\$/)
    useCatalogPricingCurrencyStore.getState().setCurrency('CNY')
    expect(formatPricingQuota(500000)).toMatch(/7/)
    expect(formatPricingQuota(500000)).not.toMatch(/\$/)
  })
})

it('keeps explicit formatting independent of the global currency preference', () => {
  useCatalogPricingCurrencyStore.setState({ currency: 'CNY' })
  expect(
    formatPricingCurrency(2, {
      currency: 'USD',
      exchangeRate: 1,
      quotaPerUnit: 500000,
    })
  ).toContain('$2')
})
it('updates bound legacy, dynamic and quota formatters when the currency changes', () => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG, usdExchangeRate: 7 } })
  const { result } = renderHook(() => usePricingFormatters())
  const usd = result.current
  expect(usd.formatPrice(model, 'input', 'M')).toContain('$1')
  act(() => {
    useCatalogPricingCurrencyStore.getState().setCurrency('CNY')
  })
  expect(result.current.currency).toBe('CNY')
  expect(result.current.formatPrice(model, 'input', 'M')).toContain('7')
  expect(result.current.formatQuota(500000)).toContain('7')
  const dynamic = result.current.getDynamicPricingSummary(
    {
      ...model,
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", p * 2 + c * 8)',
    },
    { tokenUnit: 'M' }
  )
  expect(dynamic?.primaryEntries[0].formatted).toContain('14')
  expect(usd.formatPrice(model, 'input', 'M')).toContain('$1')
})
